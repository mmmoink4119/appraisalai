import { z } from "zod";

// Property characteristics, loosely following the URAR (Form 1004) sales
// comparison grid. Every field is nullable so a partially filled property
// (e.g. from an MLS sheet missing some data) is still valid.
export const PropertySchema = z.object({
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  county: z.string().nullable(),
  parcelNumber: z.string().nullable(),
  yearBuilt: z.number().nullable(),
  gla: z.number().nullable().describe("Gross living area above grade, sq ft"),
  lotSizeSqFt: z.number().nullable(),
  bedrooms: z.number().nullable(),
  fullBaths: z.number().nullable(),
  halfBaths: z.number().nullable(),
  basementSqFt: z.number().nullable(),
  basementFinishedSqFt: z.number().nullable(),
  garageSpaces: z.number().nullable(),
  design: z.string().nullable().describe("Style, e.g. Ranch, Colonial, 2-Story"),
  condition: z.number().nullable().describe("UAD condition rating 1-6 (C1 best)"),
  quality: z.number().nullable().describe("UAD quality rating 1-6 (Q1 best)"),
  fireplaces: z.number().nullable(),
  pool: z.boolean().nullable(),
  heatingCooling: z.string().nullable(),
  view: z.string().nullable(),
});
export type Property = z.infer<typeof PropertySchema>;

// UAD sale types, as used on the URAR and the UAD 3.6 redesign.
export const SALE_TYPES = [
  "ArmsLength", "REO", "ShortSale", "CourtOrdered", "Estate", "Relocation", "NonArmsLength",
] as const;

export const CompSchema = PropertySchema.extend({
  salePrice: z.number().nullable(),
  saleDate: z.string().nullable().describe("Closing date, YYYY-MM-DD"),
  listPrice: z.number().nullable(),
  daysOnMarket: z.number().nullable(),
  saleType: z.enum(SALE_TYPES).nullable(),
  financing: z.string().nullable().describe("e.g. Conventional, FHA, VA, Cash"),
  concessions: z.number().nullable().describe("Seller concessions in dollars"),
  dataSource: z.string().nullable().describe("e.g. MLS name and listing number"),
});
export type Comp = z.infer<typeof CompSchema>;

export function emptyProperty(): Property {
  return {
    address: null, city: null, state: null, zip: null, county: null,
    parcelNumber: null, yearBuilt: null, gla: null, lotSizeSqFt: null,
    bedrooms: null, fullBaths: null, halfBaths: null, basementSqFt: null,
    basementFinishedSqFt: null, garageSpaces: null, design: null,
    condition: null, quality: null, fireplaces: null, pool: null,
    heatingCooling: null, view: null,
  };
}

export function emptyComp(): Comp {
  return {
    ...emptyProperty(), salePrice: null, saleDate: null, listPrice: null, daysOnMarket: null,
    saleType: null, financing: null, concessions: null, dataSource: null,
  };
}

// Dollar adjustment per unit of difference. These are placeholders: the
// appraiser sets them per market, usually from paired sales or regression.
export type AdjustmentRates = {
  glaPerSqFt: number;
  agePerYear: number;
  fullBath: number;
  halfBath: number;
  garageSpace: number;
  basementPerSqFt: number;
  basementFinishedPerSqFt: number;
  lotPerSqFt: number;
  conditionStep: number;
  qualityStep: number;
  fireplace: number;
  pool: number;
};

export const defaultRates: AdjustmentRates = {
  glaPerSqFt: 50,
  agePerYear: 500,
  fullBath: 7500,
  halfBath: 3500,
  garageSpace: 6000,
  basementPerSqFt: 15,
  basementFinishedPerSqFt: 20,
  lotPerSqFt: 1,
  conditionStep: 10000,
  qualityStep: 15000,
  fireplace: 2500,
  pool: 10000,
};

export type AdjustmentLine = { label: string; amount: number };

export type CompResult = {
  lines: AdjustmentLine[];
  net: number;
  gross: number;
  netPct: number | null;
  grossPct: number | null;
  adjustedPrice: number | null;
};

// Adjustments bring the comp toward the subject: if the subject has more of
// a feature than the comp, the comp's price is adjusted up, and vice versa.
// Condition and quality are inverted because 1 is the best rating.
export function adjustComp(subject: Property, comp: Comp, rates: AdjustmentRates): CompResult {
  const diff = (s: number | null, c: number | null) => (s == null || c == null ? 0 : s - c);
  const bool = (b: boolean | null) => (b == null ? null : b ? 1 : 0);

  const lines: AdjustmentLine[] = [
    { label: "Concessions", amount: -(comp.concessions ?? 0) },
    { label: "GLA", amount: diff(subject.gla, comp.gla) * rates.glaPerSqFt },
    // Newer subject (higher year built) means the comp is adjusted up.
    { label: "Age", amount: diff(subject.yearBuilt, comp.yearBuilt) * rates.agePerYear },
    { label: "Full baths", amount: diff(subject.fullBaths, comp.fullBaths) * rates.fullBath },
    { label: "Half baths", amount: diff(subject.halfBaths, comp.halfBaths) * rates.halfBath },
    { label: "Garage", amount: diff(subject.garageSpaces, comp.garageSpaces) * rates.garageSpace },
    { label: "Basement", amount: diff(subject.basementSqFt, comp.basementSqFt) * rates.basementPerSqFt },
    {
      label: "Finished bsmt",
      amount: diff(subject.basementFinishedSqFt, comp.basementFinishedSqFt) * rates.basementFinishedPerSqFt,
    },
    { label: "Site", amount: diff(subject.lotSizeSqFt, comp.lotSizeSqFt) * rates.lotPerSqFt },
    { label: "Condition", amount: diff(comp.condition, subject.condition) * rates.conditionStep },
    { label: "Quality", amount: diff(comp.quality, subject.quality) * rates.qualityStep },
    { label: "Fireplaces", amount: diff(subject.fireplaces, comp.fireplaces) * rates.fireplace },
    { label: "Pool", amount: diff(bool(subject.pool), bool(comp.pool)) * rates.pool },
  ].map((l) => ({ ...l, amount: Math.round(l.amount) }));

  const net = lines.reduce((sum, l) => sum + l.amount, 0);
  const gross = lines.reduce((sum, l) => sum + Math.abs(l.amount), 0);
  const price = comp.salePrice;
  return {
    lines,
    net,
    gross,
    netPct: price ? net / price : null,
    grossPct: price ? gross / price : null,
    adjustedPrice: price == null ? null : price + net,
  };
}

// Traditional guideline thresholds reviewers still look at.
export const NET_ADJ_WARN = 0.15;
export const GROSS_ADJ_WARN = 0.25;
