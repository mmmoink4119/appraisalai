import type { Property } from "./appraisal";
import type { ReportData } from "./report";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Cost approach as laid out on the URAR: cost new of the dwelling and garage,
// less depreciation, plus site improvements and site value.
export function costApproach(report: ReportData, subject: Property) {
  const gla = subject.gla;
  const perSqFt = num(report["cost.dwellingPerSqFt"]);
  const dwelling = gla != null && perSqFt != null ? Math.round(gla * perSqFt) : null;
  const garageSqFt = num(report["cost.garageSqFt"]);
  const garagePerSqFt = num(report["cost.garagePerSqFt"]);
  const garage = garageSqFt != null && garagePerSqFt != null ? Math.round(garageSqFt * garagePerSqFt) : null;
  const other = num(report["cost.otherCost"]);
  const costNew = dwelling == null ? null : dwelling + (garage ?? 0) + (other ?? 0);
  const depreciation =
    (num(report["cost.physicalDepreciation"]) ?? 0) +
    (num(report["cost.functionalDepreciation"]) ?? 0) +
    (num(report["cost.externalDepreciation"]) ?? 0);
  const depreciated = costNew == null ? null : costNew - depreciation;
  const siteImprovements = num(report["cost.siteImprovements"]);
  const siteValue = num(report["cost.siteValue"]);
  const indicated = depreciated == null || siteValue == null ? null : depreciated + (siteImprovements ?? 0) + siteValue;
  return { dwelling, garage, other, costNew, depreciation, depreciated, siteImprovements, siteValue, indicated };
}

export function incomeApproach(report: ReportData) {
  const rent = num(report["income.marketRent"]);
  const grm = num(report["income.grm"]);
  return { rent, grm, indicated: rent != null && grm != null ? Math.round(rent * grm) : null };
}

// Actual age as of the effective date (or today when it isn't set yet).
export function actualAge(yearBuilt: number | null, report: ReportData) {
  if (yearBuilt == null) return null;
  const effective = report["assignment.effectiveDate"];
  const year = typeof effective === "string" && /^\d{4}/.test(effective) ? Number(effective.slice(0, 4)) : new Date().getFullYear();
  return year - yearBuilt;
}
