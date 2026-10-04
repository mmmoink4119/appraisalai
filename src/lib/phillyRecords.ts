import type { Property } from "./appraisal";

// Philadelphia's Office of Property Assessment publishes every property's
// record through the city's public Carto SQL API (dataset
// opa_properties_public). No key is needed.
export const OPA_SQL_URL = "https://phl.carto.com/api/v2/sql";

export const OPA_COLUMNS = [
  "parcel_number", "location", "zip_code", "year_built", "year_built_estimate", "total_livable_area",
  "total_area", "number_of_bedrooms", "number_of_bathrooms", "number_stories", "garage_spaces", "fireplaces",
  "central_air", "building_code_description", "building_code_description_new", "category_code_description",
  "owner_1", "owner_2", "census_tract", "zoning", "market_value", "sale_date", "sale_price",
] as const;

export type OpaRecord = Partial<Record<(typeof OPA_COLUMNS)[number], string | number | null>>;

const SUFFIXES: Record<string, string> = {
  STREET: "ST", AVENUE: "AVE", ROAD: "RD", DRIVE: "DR", LANE: "LN", PLACE: "PL", BOULEVARD: "BLVD",
  COURT: "CT", TERRACE: "TER", CIRCLE: "CIR", PARKWAY: "PKWY", PIKE: "PIKE", WAY: "WAY",
};

// OPA stores addresses like "4625 LANSING ST": upper case, abbreviated
// suffix, no city or zip.
export function normalizeAddress(input: string): string {
  const street = input.split(",")[0].toUpperCase().replace(/[.#]/g, "").replace(/\s+/g, " ").trim();
  return street
    .split(" ")
    .map((w) => SUFFIXES[w] ?? w)
    .join(" ");
}

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

// Parcel numbers are 9 digits; anything else is treated as an address.
export function buildOpaQuery(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cols = OPA_COLUMNS.join(", ");
  const digits = trimmed.replace(/[\s-]/g, "");
  if (/^\d{9}$/.test(digits)) {
    return `SELECT ${cols} FROM opa_properties_public WHERE parcel_number = ${quote(digits)} LIMIT 1`;
  }
  const address = normalizeAddress(trimmed);
  if (!/^\d+\s+\S/.test(address)) return null;
  return `SELECT ${cols} FROM opa_properties_public WHERE location LIKE ${quote(`${address}%`)} ORDER BY location LIMIT 10`;
}

const num = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const isoDate = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : null);

// Fields filled from the record. OPA counts bathrooms without separating
// half baths, so the total goes to full baths for the appraiser to split.
export function opaToProperty(r: OpaRecord): Partial<Property> {
  const owners = [r.owner_1, r.owner_2].filter((o): o is string => typeof o === "string" && !!o.trim());
  const fields: Partial<Property> = {
    address: typeof r.location === "string" ? titleCase(r.location) : null,
    city: "Philadelphia",
    state: "PA",
    zip: r.zip_code ? String(r.zip_code).slice(0, 5) : null,
    county: "Philadelphia",
    parcelNumber: r.parcel_number ? String(r.parcel_number) : null,
    yearBuilt: num(r.year_built),
    gla: num(r.total_livable_area),
    lotSizeSqFt: num(r.total_area),
    bedrooms: num(r.number_of_bedrooms),
    fullBaths: num(r.number_of_bathrooms),
    garageSpaces: r.garage_spaces == null ? null : Number(r.garage_spaces),
    fireplaces: r.fireplaces == null ? null : Number(r.fireplaces),
    heatingCooling: r.central_air === "Y" ? "Central air" : null,
    ownerOfRecord: owners.length ? owners.map(titleCase).join(" & ") : null,
    censusTract: r.census_tract ? String(r.census_tract) : null,
    zoning: r.zoning ? String(r.zoning) : null,
    assessedValue: num(r.market_value),
    priorSaleDate: isoDate(r.sale_date),
    priorSalePrice: num(r.sale_price),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null)) as Partial<Property>;
}

// Context shown next to the filled fields; not mapped to URAR fields.
export function opaNotes(r: OpaRecord): string[] {
  const notes: string[] = [];
  const building = r.building_code_description_new ?? r.building_code_description;
  if (building) notes.push(`Building: ${titleCase(String(building))}`);
  if (r.number_stories) notes.push(`${r.number_stories} stories`);
  if (r.year_built_estimate === "Y") notes.push("Year built is the city's estimate");
  if (r.number_of_bathrooms) notes.push("City counts all bathrooms together; split full and half baths");
  return notes;
}
