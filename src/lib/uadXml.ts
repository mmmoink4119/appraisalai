// Writes the report as UAD 2.6 XML (MISMO Valuation Response 2.6 Errata 1
// with the GSE extension), the file TOTAL opens with File > Open UAD XML.
//
// Each row below is one row of the GSEs' "UAD Specification Appendix A:
// GSE Appraisal Forms Mapping" for Form 1004, with its Sort ID and XPath
// copied as written there, so the mapping can be checked line by line.
// Rows after Sort ID 86 (site onward) are not mapped yet.

import type { Property } from "./appraisal";
import type { ReportData } from "./report";

type Ctx = { subject: Property; report: ReportData };
type Value = string | number | boolean | null | undefined;

// An attribute row writes its value; a row whose XPath ends in a predicate
// (a checkbox on the form) sets those attributes when `value` is true.
export type MappingRow = { sort: number; xpath: string; format: "String" | "Money" | "Numeric" | "Boolean" | "Date"; value: (c: Ctx) => Value };

const UAD = "[@ExtensionSectionOrganizationName='UNIFORM APPRAISAL DATASET']";
const r = (key: string) => (c: Ctx) => c.report[key];
const is = (key: string, option: string) => (c: Ctx) => c.report[key] === option;
const yes = (key: string) => (c: Ctx) => c.report[key] === true;
const no = (key: string) => (c: Ctx) => c.report[key] === false;
const thousands = (key: string) => (c: Ctx) => {
  const n = c.report[key];
  return typeof n === "number" ? Math.round(n / 1000) : null;
};
const enumRows = (sorts: number[], xpath: (v: string) => string, key: string, pairs: [string, string][]): MappingRow[] =>
  pairs.map(([option, value], i) => ({ sort: sorts[i], xpath: xpath(value), format: "String", value: is(key, option) }));

const PURPOSES = ["Purchase", "Refinance"];

export const MAPPING_1004: MappingRow[] = [
  { sort: 1, xpath: "/VALUATION_RESPONSE/REPORT/@AppraisalFormType", format: "String", value: () => "FNM1004" },
  { sort: 4, xpath: "/VALUATION_RESPONSE/REPORT/@AppraiserFileIdentifier", format: "String", value: r("assignment.fileNumber") },
  { sort: 7, xpath: "/VALUATION_RESPONSE/PROPERTY/@_StreetAddress", format: "String", value: (c) => c.subject.address },
  { sort: 8, xpath: "/VALUATION_RESPONSE/PROPERTY/@_City", format: "String", value: (c) => c.subject.city },
  { sort: 9, xpath: "/VALUATION_RESPONSE/PROPERTY/@_State", format: "String", value: (c) => c.subject.state },
  { sort: 10, xpath: "/VALUATION_RESPONSE/PROPERTY/@_PostalCode", format: "String", value: (c) => c.subject.zip },
  {
    sort: 11,
    xpath: `/VALUATION_RESPONSE/PARTIES/BORROWER/BORROWER_EXTENSION/BORROWER_EXTENSION_SECTION${UAD}/BORROWER_EXTENSION_SECTION_DATA/BORROWER_NAME/@GSEBorrowerName`,
    format: "String",
    value: r("assignment.borrower"),
  },
  {
    sort: 12,
    xpath: `/VALUATION_RESPONSE/PROPERTY/_OWNER/PROPERTY_OWNER_EXTENSION/PROPERTY_OWNER_EXTENSION_SECTION${UAD}/PROPERTY_OWNER_EXTENSION_SECTION_DATA/PROPERTY_OWNER/@GSEPropertyOwnerName`,
    format: "String",
    value: (c) => c.subject.ownerOfRecord,
  },
  { sort: 13, xpath: "/VALUATION_RESPONSE/PROPERTY/@_County", format: "String", value: (c) => c.subject.county },
  {
    sort: 14,
    xpath: "/VALUATION_RESPONSE/PROPERTY/_LEGAL_DESCRIPTION[@_Type='Other' and @_TypeOtherDescription='LongLegal']/@_TextDescription",
    format: "String",
    value: r("assignment.legalDescription"),
  },
  {
    sort: 15,
    xpath: `/VALUATION_RESPONSE/PROPERTY/_IDENTIFICATION/PROPERTY_IDENTIFICATION_EXTENSION/PROPERTY_IDENTIFICATION_EXTENSION_SECTION${UAD}/PROPERTY_IDENTIFICATION_EXTENSION_SECTION_DATA/PARCEL_IDENTIFIER/@GSEAssessorsParcelIdentifier`,
    format: "String",
    value: (c) => c.subject.parcelNumber,
  },
  { sort: 16, xpath: "/VALUATION_RESPONSE/PROPERTY/_TAX/@_YearIdentifier", format: "String", value: r("assignment.taxYear") },
  {
    sort: 17,
    xpath: `/VALUATION_RESPONSE/PROPERTY/_TAX/PROPERTY_TAX_EXTENSION/PROPERTY_TAX_EXTENSION_SECTION${UAD}/PROPERTY_TAX_EXTENSION_SECTION_DATA/PROPERTY_TAX_AMOUNT/@GSEPropertyTaxTotalTaxAmount`,
    format: "Money",
    value: r("assignment.taxes"),
  },
  { sort: 18, xpath: "/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD/@_Name", format: "String", value: r("assignment.neighborhoodName") },
  { sort: 19, xpath: "/VALUATION_RESPONSE/PROPERTY/_IDENTIFICATION/@MapReferenceIdentifier", format: "String", value: r("assignment.mapReference") },
  { sort: 20, xpath: "/VALUATION_RESPONSE/PROPERTY/_IDENTIFICATION/@CensusTractIdentifier", format: "String", value: (c) => c.subject.censusTract },
  ...enumRows([21, 22, 23], (v) => `/VALUATION_RESPONSE/PROPERTY[@_CurrentOccupancyType='${v}']`, "assignment.occupant", [
    ["Owner", "OwnerOccupied"], ["Tenant", "TenantOccupied"], ["Vacant", "Vacant"],
  ]),
  { sort: 24, xpath: "/VALUATION_RESPONSE/PROPERTY/_TAX/@_TotalSpecialTaxAmount", format: "Money", value: r("assignment.specialAssessments") },
  {
    sort: 25,
    xpath: `/VALUATION_RESPONSE/PROPERTY/PROPERTY_EXTENSION/PROPERTY_EXTENSION_SECTION${UAD}/PROPERTY_EXTENSION_SECTION_DATA/PROPERTY_TYPE/@GSE_PUDIndicator`,
    format: "Boolean",
    value: r("assignment.pud"),
  },
  { sort: 26, xpath: "/VALUATION_RESPONSE/PROPERTY/PROJECT/_PER_UNIT_FEE/@_Amount", format: "Money", value: r("assignment.hoaDues") },
  ...enumRows([27, 28], (v) => `/VALUATION_RESPONSE/PROPERTY/PROJECT/_PER_UNIT_FEE[@_PeriodType='${v}']`, "assignment.hoaPeriod", [
    ["per year", "Annually"], ["per month", "Monthly"],
  ]),
  ...enumRows([29, 30, 31], (v) => `/VALUATION_RESPONSE/PROPERTY[@_RightsType='${v}']`, "assignment.propertyRights", [
    ["Fee Simple", "FeeSimple"], ["Leasehold", "Leasehold"], ["Other", "Other"],
  ]),
  { sort: 33, xpath: "/VALUATION_RESPONSE/REPORT[@AppraisalPurposeType='Purchase']", format: "String", value: is("assignment.assignmentType", "Purchase") },
  { sort: 34, xpath: "/VALUATION_RESPONSE/REPORT[@AppraisalPurposeType='Refinance']", format: "String", value: is("assignment.assignmentType", "Refinance") },
  {
    sort: 35,
    xpath: "/VALUATION_RESPONSE/REPORT[@AppraisalPurposeType='Other']",
    format: "String",
    value: (c) => typeof c.report["assignment.assignmentType"] === "string" && !PURPOSES.includes(c.report["assignment.assignmentType"]),
  },
  {
    sort: 36,
    xpath: "/VALUATION_RESPONSE/REPORT/@AppraisalPurposeTypeOtherDescription",
    format: "String",
    // UAD 3.6 reasons like Home Equity go in Form 1004's "Other (describe)".
    value: (c) => {
      const t = c.report["assignment.assignmentType"];
      return typeof t === "string" && !PURPOSES.includes(t) && t !== "Other" ? t : null;
    },
  },
  { sort: 37, xpath: "/VALUATION_RESPONSE/PARTIES/LENDER/@_UnparsedName", format: "String", value: r("assignment.clientName") },
  { sort: 38, xpath: "/VALUATION_RESPONSE/PARTIES/LENDER/@AppraisalFormsUnparsedAddress", format: "String", value: r("assignment.clientAddress") },
  { sort: 39, xpath: "/VALUATION_RESPONSE/PROPERTY/LISTING_HISTORY[@ListedWithinPreviousYearIndicator='Y']", format: "String", value: yes("assignment.offeredForSale") },
  { sort: 40, xpath: "/VALUATION_RESPONSE/PROPERTY/LISTING_HISTORY[@ListedWithinPreviousYearIndicator='N']", format: "String", value: no("assignment.offeredForSale") },
  { sort: 42, xpath: "/VALUATION_RESPONSE/PROPERTY/LISTING_HISTORY/@ListedWithinPreviousYearDescription", format: "String", value: r("assignment.offeringHistory") },
  // The worksheet has no separate "did analyze" box: a written contract analysis counts as yes.
  {
    sort: 43,
    xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT[@_ReviewedIndicator='Y']",
    format: "String",
    value: (c) => c.report["assignment.assignmentType"] === "Purchase" && !!c.report["contract.analysis"],
  },
  { sort: 46, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT/@_ReviewComment", format: "String", value: r("contract.analysis") },
  { sort: 47, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT/@_Amount", format: "Money", value: r("contract.price") },
  { sort: 48, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT/@_Date", format: "Date", value: r("contract.date") },
  { sort: 49, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT[@SellerIsOwnerIndicator='Y']", format: "String", value: yes("contract.sellerIsOwner") },
  { sort: 50, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT[@SellerIsOwnerIndicator='N']", format: "String", value: no("contract.sellerIsOwner") },
  { sort: 51, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT/@DataSourceDescription", format: "String", value: r("contract.dataSource") },
  { sort: 52, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT[@SalesConcessionIndicator='Y']", format: "String", value: yes("contract.assistance") },
  { sort: 53, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT[@SalesConcessionIndicator='N']", format: "String", value: no("contract.assistance") },
  { sort: 54, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT/@SalesConcessionAmount", format: "Money", value: r("contract.assistanceAmount") },
  {
    sort: 55,
    xpath: `/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT/SALES_CONCESSION_EXTENSION/SALES_CONCESSION_EXTENSION_SECTION${UAD}/SALES_CONCESSION_EXTENSION_SECTION_DATA/SALES_CONCESSION/@GSEUndefinedConcessionAmountIndicator`,
    format: "Boolean",
    value: (c) => (c.report["contract.assistance"] === true ? c.report["contract.assistanceAmount"] == null : null),
  },
  { sort: 56, xpath: "/VALUATION_RESPONSE/PROPERTY/SALES_CONTRACT/@SalesConcessionDescription", format: "String", value: r("contract.assistanceDescription") },
  ...enumRows([57, 58, 59], (v) => `/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD[@PropertyNeighborhoodLocationType='${v}']`, "neighborhood.location", [
    ["Urban", "Urban"], ["Suburban", "Suburban"], ["Rural", "Rural"],
  ]),
  ...enumRows([60, 61, 62], (v) => `/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD[@_BuiltupRangeType='${v}']`, "neighborhood.builtUp", [
    ["Over 75%", "Over75Percent"], ["25-75%", "25To75Percent"], ["Under 25%", "Under25Percent"],
  ]),
  ...enumRows([63, 64, 65], (v) => `/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD[@_GrowthPaceType='${v}']`, "neighborhood.growth", [
    ["Rapid", "Rapid"], ["Stable", "Stable"], ["Slow", "Slow"],
  ]),
  ...enumRows([66, 67, 68], (v) => `/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD[@_PropertyValueTrendType='${v}']`, "neighborhood.propertyValues", [
    ["Increasing", "Increasing"], ["Stable", "Stable"], ["Declining", "Declining"],
  ]),
  ...enumRows([69, 70, 71], (v) => `/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD[@_DemandSupplyType='${v}']`, "neighborhood.demandSupply", [
    ["Shortage", "Shortage"], ["In Balance", "InBalance"], ["Over Supply", "OverSupply"],
  ]),
  ...enumRows([72, 73, 74], (v) => `/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD[@_TypicalMarketingTimeDurationType='${v}']`, "neighborhood.marketingTime", [
    ["Under 3 mths", "UnderThreeMonths"], ["3-6 mths", "ThreeToSixMonths"], ["Over 6 mths", "OverSixMonths"],
  ]),
  // The form's price columns are in thousands ("Price $(000)").
  { sort: 75, xpath: "/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD/_HOUSING[@_Type='SingleFamily']/@_LowPriceAmount", format: "Money", value: thousands("neighborhood.priceLow") },
  { sort: 76, xpath: "/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD/_HOUSING[@_Type='SingleFamily']/@_HighPriceAmount", format: "Money", value: thousands("neighborhood.priceHigh") },
  { sort: 77, xpath: "/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD/_HOUSING[@_Type='SingleFamily']/@_PredominantPriceAmount", format: "Money", value: thousands("neighborhood.pricePredominant") },
  { sort: 78, xpath: "/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD/_HOUSING[@_Type='SingleFamily']/@_NewestYearsCount", format: "Numeric", value: r("neighborhood.ageLow") },
  { sort: 79, xpath: "/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD/_HOUSING[@_Type='SingleFamily']/@_OldestYearsCount", format: "Numeric", value: r("neighborhood.ageHigh") },
  { sort: 80, xpath: "/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD/_HOUSING[@_Type='SingleFamily']/@_PredominantAgeYearsCount", format: "Numeric", value: r("neighborhood.agePredominant") },
  ...(
    [
      [81, "SingleFamily", "neighborhood.landUseOneUnit"],
      [82, "TwoToFourFamily", "neighborhood.landUse2to4"],
      [83, "Apartment", "neighborhood.landUseMulti"],
      [84, "Commercial", "neighborhood.landUseCommercial"],
      [85, "Other", "neighborhood.landUseOther"],
    ] as const
  ).map(([sort, type, key]): MappingRow => ({
    sort,
    xpath: `/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD/_PRESENT_LAND_USE[@_Type='${type}']/@_Percent`,
    format: "Numeric",
    value: r(key),
  })),
  {
    sort: 86,
    xpath: `/VALUATION_RESPONSE/PROPERTY/NEIGHBORHOOD/NEIGHBORHOOD_EXTENSION/NEIGHBORHOOD_EXTENSION_SECTION${UAD}/NEIGHBORHOOD_EXTENSION_SECTION_DATA/NEIGHBORHOOD_BOUNDARIES/@GSENeighborhoodBoundariesDescription`,
    format: "String",
    value: r("neighborhood.boundaries"),
  },
];

// A tiny element tree, built by walking each row's XPath.
type Node = { name: string; attrs: [string, string][]; children: Node[] };

type Step = { name: string; predicate: [string, string][] };

function parseStep(raw: string): Step {
  const m = raw.match(/^([A-Za-z_][\w]*)(?:\[(.*)\])?$/);
  if (!m) throw new Error(`Unsupported XPath step: ${raw}`);
  const predicate = m[2]
    ? m[2].split(/\s+and\s+/).map((p) => {
        const pm = p.match(/^@([\w]+)='([^']*)'$/);
        if (!pm) throw new Error(`Unsupported XPath predicate: ${p}`);
        return [pm[1], pm[2]] as [string, string];
      })
    : [];
  return { name: m[1], predicate };
}

const getAttr = (n: Node, k: string) => n.attrs.find(([a]) => a === k)?.[1];
function setAttr(n: Node, k: string, v: string) {
  const i = n.attrs.findIndex(([a]) => a === k);
  if (i >= 0) n.attrs[i] = [k, v];
  else n.attrs.push([k, v]);
}

// Predicates pick (or create) the matching child, except on the last step
// of a checkbox row, where they are the value to set on the element.
function walk(root: Node, steps: Step[], checkbox: boolean): Node {
  let node = root;
  steps.forEach((step, i) => {
    const last = checkbox && i === steps.length - 1;
    const match = (c: Node) => c.name === step.name && (last || step.predicate.every(([k, v]) => getAttr(c, k) === v));
    let child = node.children.find(match);
    if (!child) {
      child = { name: step.name, attrs: [], children: [] };
      node.children.push(child);
    }
    for (const [k, v] of step.predicate) setAttr(child, k, v);
    node = child;
  });
  return node;
}

function formatValue(format: MappingRow["format"], v: Exclude<Value, null | undefined>): string | null {
  switch (format) {
    case "Boolean":
      return typeof v === "boolean" ? (v ? "Y" : "N") : null;
    case "Money":
      return typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : null;
    case "Numeric":
      return typeof v === "number" && Number.isFinite(v) ? String(v) : null;
    case "Date":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    default:
      return String(v).trim() || null;
  }
}

export function buildUadXml(ctx: Ctx, mapping: MappingRow[] = MAPPING_1004): string {
  // MISMO's top-level containers, in schema order; empty ones are dropped.
  const top = ["REPORT", "PARTIES", "PROPERTY", "VALUATION_METHODS", "VALUATION"];
  const root: Node = {
    name: "VALUATION_RESPONSE",
    attrs: [["MISMOVersionID", "2.6"]],
    children: top.map((name) => ({ name, attrs: [], children: [] })),
  };
  for (const row of mapping) {
    const v = row.value(ctx);
    const isAttr = /\/@\w+$/.test(row.xpath);
    // false is "N" for a Y/N attribute, but leaves a checkbox unchecked.
    if (v == null || v === "" || (v === false && !isAttr)) continue;
    const parts = row.xpath.split("/").filter(Boolean);
    if (parts.shift() !== "VALUATION_RESPONSE") throw new Error(`XPath must start at VALUATION_RESPONSE: ${row.xpath}`);
    const attr = parts[parts.length - 1].startsWith("@") ? parts.pop()!.slice(1) : null;
    const node = walk(root, parts.map(parseStep), !attr);
    if (attr) {
      const text = formatValue(row.format, v as Exclude<Value, null | undefined>);
      if (text != null) setAttr(node, attr, text);
    }
  }
  root.children = root.children.filter((c) => c.attrs.length || c.children.length);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialize(root, 0)}\n`;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function serialize(n: Node, depth: number): string {
  const pad = "  ".repeat(depth);
  const attrs = n.attrs.map(([k, v]) => ` ${k}="${escape(v)}"`).join("");
  if (!n.children.length) return `${pad}<${n.name}${attrs}/>`;
  return `${pad}<${n.name}${attrs}>\n${n.children.map((c) => serialize(c, depth + 1)).join("\n")}\n${pad}</${n.name}>`;
}
