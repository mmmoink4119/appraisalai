import { z } from "zod";
import { type Comp, SALE_TYPES, emptyComp } from "./appraisal";

// Minimal RFC 4180 parser: quoted fields, escaped quotes, embedded newlines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Comp fields a CSV column can be mapped to, and how to read the cell.
export const IMPORT_FIELDS = [
  "status", "salePrice", "saleDate", "listPrice", "daysOnMarket", "saleType", "financing", "concessions", "dataSource",
  "address", "city", "state", "zip", "county", "parcelNumber", "yearBuilt", "gla", "lotSizeSqFt",
  "bedrooms", "fullBaths", "halfBaths", "basementSqFt", "basementFinishedSqFt", "garageSpaces",
  "design", "condition", "quality", "fireplaces", "pool", "heatingCooling", "view",
] as const satisfies readonly (keyof Comp)[];
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const TRANSFORMS = [
  "text", // copy as is
  "number", // first number in the cell, ignoring $ and commas
  "date", // to YYYY-MM-DD
  "acresToSqFt", // lot size given in acres
  "bathsDecimalFull", // "2.1" style total baths: full part
  "bathsDecimalHalf", // "2.1" style total baths: half part
  "yesNo", // Y/N, Yes/No, True/False, "No Pool"; any other non-empty value means yes
  "saleType", // MLS sale type wording to a UAD sale type
] as const;
export type Transform = (typeof TRANSFORMS)[number];

export const ColumnMappingSchema = z.object({
  mappings: z.array(
    z.object({
      field: z.enum(IMPORT_FIELDS),
      column: z.string().nullable().describe("Exact CSV header text, or null if no column holds this field"),
      transform: z.enum(TRANSFORMS),
    }),
  ),
});
export type ColumnMapping = z.infer<typeof ColumnMappingSchema>["mappings"];

function toNumber(cell: string): number | null {
  const m = cell.replace(/[$,\s]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function toDate(cell: string): string | null {
  const s = cell.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return s || null;
}

function toSaleType(cell: string): Comp["saleType"] {
  const s = cell.toLowerCase();
  if (!s.trim()) return null;
  if (/reo|bank|foreclos/.test(s)) return "REO";
  if (/short/.test(s)) return "ShortSale";
  if (/court|auction/.test(s)) return "CourtOrdered";
  if (/estate|probate/.test(s)) return "Estate";
  if (/reloc/.test(s)) return "Relocation";
  if (/non.?arm/.test(s)) return "NonArmsLength";
  return SALE_TYPES[0];
}

export function applyTransform(cell: string, transform: Transform): string | number | boolean | null {
  const s = cell.trim();
  if (!s) return null;
  switch (transform) {
    case "text":
      return s;
    case "number":
      return toNumber(s);
    case "date":
      return toDate(s);
    case "acresToSqFt": {
      const n = toNumber(s);
      return n == null ? null : Math.round(n * 43560);
    }
    case "bathsDecimalFull": {
      const n = toNumber(s);
      return n == null ? null : Math.floor(n);
    }
    case "bathsDecimalHalf": {
      // "2.1" means 2 full and 1 half; the digit after the point is a count.
      const frac = s.match(/\.(\d)/);
      return frac ? Number(frac[1]) : 0;
    }
    case "yesNo":
      return !/^(n|no|none|false|0)\b/i.test(s);
    case "saleType":
      return toSaleType(s);
  }
}

export function rowToComp(headers: string[], row: string[], mapping: ColumnMapping): Comp {
  const comp: Record<string, unknown> = emptyComp();
  for (const { field, column, transform } of mapping) {
    if (!column) continue;
    const idx = headers.indexOf(column);
    if (idx === -1) continue;
    comp[field] = applyTransform(row[idx] ?? "", transform);
  }
  return comp as Comp;
}

// Mappings are remembered per header layout, so a second export from the
// same MLS search skips the AI step.
export function headerSignature(headers: string[]): string {
  return headers.map((h) => h.trim().toLowerCase()).join("|");
}

// Header aliases for common MLS / RESO export names. Used when the AI step
// is unavailable; the appraiser can still fix any column in the UI.
const ALIASES: Partial<Record<ImportField, [string[], Transform]>> = {
  status: [["standardstatus", "status", "mlsstatus", "listingstatus"], "text"],
  salePrice: [["closeprice", "soldprice", "saleprice", "closedprice", "sp"], "number"],
  saleDate: [["closedate", "solddate", "saledate", "closingdate", "coe"], "date"],
  listPrice: [["listprice", "lp", "originallistprice"], "number"],
  daysOnMarket: [["daysonmarket", "dom", "cdom", "cumulativedaysonmarket"], "number"],
  saleType: [["speciallistingconditions", "saletype", "salecondition", "saletypes"], "saleType"],
  financing: [["buyerfinancing", "financing", "financingtype", "terms"], "text"],
  concessions: [["concessionsamount", "concessionsfinal", "sellerconcessions", "concessions", "sellercontribution"], "number"],
  dataSource: [["listingid", "mlsnumber", "mls", "mlsid", "listingnumber", "ml"], "text"],
  address: [["unparsedaddress", "fullstreetaddress", "address", "streetaddress", "fulladdress"], "text"],
  city: [["city"], "text"],
  state: [["stateorprovince", "state", "st"], "text"],
  zip: [["postalcode", "zip", "zipcode"], "text"],
  county: [["countyorparish", "county"], "text"],
  parcelNumber: [["parcelnumber", "apn", "taxid", "pin"], "text"],
  yearBuilt: [["yearbuilt", "yrbuilt", "yearblt"], "number"],
  gla: [["livingarea", "gla", "sqftabovegrade", "abovegradefinishedarea", "abovegradefinishedsqft", "sqft", "squarefeet"], "number"],
  lotSizeSqFt: [["lotsizesquarefeet", "lotsizesqft", "lotsqft", "lotsize"], "number"],
  bedrooms: [["bedroomstotal", "bedrooms", "beds", "br"], "number"],
  fullBaths: [["bathroomsfull", "fullbaths", "bathsfull"], "number"],
  halfBaths: [["bathroomshalf", "halfbaths", "bathshalf"], "number"],
  basementSqFt: [["belowgradetotalarea", "basementsqft", "basementarea"], "number"],
  basementFinishedSqFt: [["belowgradefinishedarea", "belowgradefinishedsqft", "basementfinishedsqft", "finishedbasement"], "number"],
  garageSpaces: [["totalgaragespaces", "garagespaces", "garagestalls"], "number"],
  design: [["architecturalstyle", "style", "design"], "text"],
  fireplaces: [["fireplacestotal", "fireplaces"], "number"],
  pool: [["poolprivateyn", "pool"], "yesNo"],
  heatingCooling: [["heatingtype", "heating"], "text"],
  view: [["view", "views"], "text"],
};

export function guessMapping(headers: string[]): ColumnMapping {
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  return IMPORT_FIELDS.map((field) => {
    const alias = ALIASES[field];
    const column = alias?.[0].map((a) => byNorm.get(a)).find(Boolean) ?? null;
    if (field === "lotSizeSqFt" && !column) {
      const acres = byNorm.get("lotsizeacres") ?? byNorm.get("lotacres") ?? byNorm.get("acres") ?? null;
      return { field, column: acres, transform: "acresToSqFt" as const };
    }
    if ((field === "fullBaths" || field === "halfBaths") && !column) {
      const total = byNorm.get("bathroomstotaldecimal") ?? byNorm.get("bathstotal") ?? byNorm.get("baths") ?? null;
      const transform = field === "fullBaths" ? "bathsDecimalFull" : "bathsDecimalHalf";
      return { field, column: total, transform: total ? transform : "number" };
    }
    return { field, column, transform: alias?.[1] ?? "text" };
  });
}
