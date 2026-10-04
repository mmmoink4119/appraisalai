import { MC_PERIODS, MC_ROWS, TRENDS, type McPeriod, type McRow, type ReportData, mcKey } from "./report";

// Market Conditions Addendum (1004MC) figures from an MLS export of the
// subject's market: every sale in the last 12 months plus current listings.

export type MarketStatus = "closed" | "active" | "pending" | "off";

export type MarketRecord = {
  status: MarketStatus;
  listDate: Date | null;
  // When the listing stopped being available: under agreement, canceled,
  // withdrawn or expired.
  offMarketDate: Date | null;
  closeDate: Date | null;
  closePrice: number | null;
  listPrice: number | null;
  dom: number | null;
  concessions: number | null;
  saleType: string | null;
  yearBuilt: number | null;
};

const COLUMNS = {
  status: ["Status", "StandardStatus", "MlsStatus", "Listing Status"],
  listDate: ["Listing Entry Date", "OnMarketDate", "ListingContractDate", "List Date", "Listing Date"],
  agreementDate: ["Agreement of Sale/Signed Lease Date", "PurchaseContractDate", "Pending Date", "Contract Date"],
  cancelDate: ["Cancelation Date", "Cancellation Date", "CancellationDate"],
  withdrawnDate: ["Withdrawn Date", "WithdrawnDate"],
  expirationDate: ["Expiration Date", "ExpirationDate"],
  statusChange: ["Status Change Timestamp", "StatusChangeTimestamp"],
  closeDate: ["Close Date", "CloseDate", "Sold Date", "Settled Date"],
  closePrice: ["Close Price", "ClosePrice", "Sold Price", "Sale Price"],
  listPrice: ["List Price", "ListPrice", "Current Price"],
  dom: ["DOM", "DaysOnMarket", "Days on Market"],
  concessions: ["Concessions Final", "ConcessionsAmount", "Concessions", "Seller Concessions"],
  saleType: ["Sale Type", "SpecialListingConditions", "Sale Terms"],
  yearBuilt: ["Year Built", "YearBuilt"],
} as const;
type Column = keyof typeof COLUMNS;

// Columns the figures can't be calculated without.
const REQUIRED: Column[] = ["status", "closeDate", "closePrice", "listPrice"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function findColumns(headers: string[]) {
  const index = new Map(headers.map((h, i) => [norm(h), i]));
  return Object.fromEntries(
    Object.entries(COLUMNS).map(([key, names]) => [key, names.map((n) => index.get(norm(n))).find((i) => i != null) ?? -1]),
  ) as Record<Column, number>;
}

function parseDate(s: string | undefined): Date | null {
  if (!s?.trim()) return null;
  const us = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const iso = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = us ? new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2])) : iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function parseNumber(s: string | undefined): number | null {
  if (!s?.trim()) return null;
  const n = Number(s.replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// MLS status codes and names: Bright uses CLS/ACT/PND, RESO uses Closed/Active/Pending.
function parseStatus(s: string | undefined): MarketStatus | null {
  const v = (s ?? "").trim().toLowerCase();
  if (!v) return null;
  if (/^(cls|closed|sold|settled)/.test(v)) return "closed";
  if (/^(pnd|pending|under contract|active under contract|auc|contingent|ctg)/.test(v)) return "pending";
  if (/^(act|active|new|coming soon)/.test(v)) return "active";
  return "off";
}

export function marketRecords(headers: string[], rows: string[][]) {
  const col = findColumns(headers);
  const missing = REQUIRED.filter((c) => col[c] < 0);
  const get = (row: string[], c: Column) => (col[c] >= 0 ? row[col[c]] : undefined);
  const records: MarketRecord[] = [];
  for (const row of rows) {
    const status = parseStatus(get(row, "status"));
    if (!status) continue;
    const closeDate = status === "closed" ? parseDate(get(row, "closeDate")) : null;
    const offMarketDate =
      parseDate(get(row, "agreementDate")) ??
      parseDate(get(row, "cancelDate")) ??
      parseDate(get(row, "withdrawnDate")) ??
      (status === "closed" ? closeDate : null) ??
      (status === "off" ? parseDate(get(row, "expirationDate")) ?? parseDate(get(row, "statusChange")) : null);
    const listDate = parseDate(get(row, "listDate"));
    const dom = parseNumber(get(row, "dom"));
    // No off-market date in the export: list date plus days on market.
    const estimatedOff = listDate && dom != null ? new Date(listDate.getTime() + dom * DAY) : null;
    records.push({
      status,
      listDate,
      offMarketDate: status === "active" ? null : offMarketDate ?? estimatedOff,
      closeDate,
      closePrice: status === "closed" ? parseNumber(get(row, "closePrice")) : null,
      listPrice: parseNumber(get(row, "listPrice")),
      dom,
      concessions: parseNumber(get(row, "concessions")),
      saleType: get(row, "saleType")?.trim() || null,
      yearBuilt: parseNumber(get(row, "yearBuilt")),
    });
  }
  return { records, missing, hasListDates: col.listDate >= 0 };
}

const DAY = 86_400_000;

function monthsBefore(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round = (n: number | null, digits = 0) => (n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits);

// A listing counts as active on a date when it was listed by then and had
// not yet gone under agreement, been canceled or withdrawn.
function activeOn(r: MarketRecord, date: Date, effective: Date) {
  if (r.listDate) return r.listDate <= date && (r.offMarketDate == null || r.offMarketDate > date);
  // Without list dates only today's listings can be counted.
  return date.getTime() === effective.getTime() && r.status === "active";
}

const DISTRESSED = /reo|bank|foreclos|short|auction|lender|hud/i;

type Trend = (typeof TRENDS)[number];

export function marketConditions(records: MarketRecord[], effective: Date) {
  const figures = Object.fromEntries(MC_ROWS.map((r) => [r.id, {}])) as Record<McRow, Record<McPeriod, number | null>>;
  let start = effective;
  for (const period of [...MC_PERIODS].reverse()) {
    // Periods run back from the effective date: 0-3, 4-6 and 7-12 months.
    const end = start;
    start = monthsBefore(end, period.months);
    const sales = records.filter((r) => r.status === "closed" && r.closeDate && r.closeDate > start && r.closeDate <= end && r.closePrice);
    const listings = records.filter((r) => activeOn(r, end, effective));
    const absorption = sales.length / period.months;
    const listingDom = listings.map((r) => (r.listDate ? Math.round((end.getTime() - r.listDate.getTime()) / DAY) : r.dom)).filter((n): n is number => n != null);
    const ratios = sales.filter((r) => r.listPrice).map((r) => (r.closePrice! / r.listPrice!) * 100);
    const set = (row: McRow, value: number | null) => (figures[row][period.id] = value);
    set("salesCount", sales.length);
    set("absorption", round(absorption, 2));
    set("listings", listings.length);
    set("supply", absorption ? round(listings.length / absorption, 1) : null);
    set("medianSalePrice", round(median(sales.map((r) => r.closePrice!))));
    set("medianSaleDom", round(median(sales.map((r) => r.dom).filter((n): n is number => n != null))));
    set("medianListPrice", round(median(listings.map((r) => r.listPrice).filter((n): n is number => n != null))));
    set("medianListDom", round(median(listingDom)));
    set("saleToList", round(median(ratios), 1));
  }

  // Trend from the oldest period with data to the current one; under 5%
  // either way is stable.
  const trend = Object.fromEntries(
    MC_ROWS.map(({ id }) => {
      const before = figures[id].p712 ?? figures[id].p46;
      const now = figures[id].p03;
      if (before == null || now == null || (before === 0 && now === 0)) return [id, null];
      const change = before === 0 ? 1 : (now - before) / Math.abs(before);
      return [id, change > 0.05 ? "Increasing" : change < -0.05 ? "Declining" : "Stable"];
    }),
  ) as Record<McRow, Trend | null>;

  // The same data answers several URAR fields.
  const yearAgo = monthsBefore(effective, 12);
  const sales12 = records.filter((r) => r.status === "closed" && r.closeDate && r.closeDate > yearAgo && r.closeDate <= effective && r.closePrice);
  const listingsNow = records.filter((r) => activeOn(r, effective, effective) && r.listPrice);
  const prices = sales12.map((r) => r.closePrice!);
  const listPrices = listingsNow.map((r) => r.listPrice!);
  const ages = [...sales12, ...listingsNow].map((r) => r.yearBuilt).filter((y): y is number => y != null).map((y) => effective.getFullYear() - y);
  const withConcessions = sales12.filter((r) => (r.concessions ?? 0) > 0);
  const distressed = sales12.filter((r) => r.saleType && DISTRESSED.test(r.saleType));

  return {
    figures,
    trend,
    sales12: sales12.length,
    listingsNow: listingsNow.length,
    priceLow: prices.length ? Math.min(...prices) : null,
    priceHigh: prices.length ? Math.max(...prices) : null,
    priceMedian: round(median(prices)),
    listLow: listPrices.length ? Math.min(...listPrices) : null,
    listHigh: listPrices.length ? Math.max(...listPrices) : null,
    ageLow: ages.length ? Math.min(...ages) : null,
    ageHigh: ages.length ? Math.max(...ages) : null,
    ageMedian: round(median(ages)),
    concessionShare: sales12.length ? withConcessions.length / sales12.length : null,
    medianConcession: round(median(withConcessions.map((r) => r.concessions!))),
    distressedShare: sales12.length ? distressed.length / sales12.length : null,
  };
}
export type MarketResult = ReturnType<typeof marketConditions>;

const money = (n: number | null) => (n == null ? "" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));

// Report fields filled from the result. Neighborhood ranges and competing
// listing/sale counts are optional because the appraiser may define the
// neighborhood more narrowly than the MLS search.
export function marketFields(result: MarketResult, { includeNeighborhood }: { includeNeighborhood: boolean }): ReportData {
  const out: ReportData = {};
  for (const row of MC_ROWS) {
    for (const p of MC_PERIODS) out[mcKey(row.id, p.id)] = result.figures[row.id][p.id];
    out[mcKey(row.id, "trend")] = result.trend[row.id];
  }
  if (result.concessionShare != null) {
    out["market.assistancePrevalent"] = result.concessionShare >= 0.5;
    out["market.assistanceTrend"] =
      `${Math.round(result.concessionShare * 100)}% of the sales in the past 12 months included seller concessions` +
      (result.medianConcession ? `, with a median of ${money(result.medianConcession)}.` : ".");
  }
  if (result.distressedShare != null) {
    out["market.foreclosureFactor"] = result.distressedShare >= 0.1;
    out["market.foreclosureTrend"] = `${Math.round(result.distressedShare * 100)}% of the sales in the past 12 months were REO, short or other distressed sales.`;
  }
  if (includeNeighborhood) {
    Object.assign(out, {
      "sales.salesCount": result.sales12,
      "sales.salesLow": result.priceLow,
      "sales.salesHigh": result.priceHigh,
      "sales.listingsCount": result.listingsNow,
      "sales.listingsLow": result.listLow,
      "sales.listingsHigh": result.listHigh,
      "neighborhood.priceLow": result.priceLow,
      "neighborhood.priceHigh": result.priceHigh,
      "neighborhood.pricePredominant": result.priceMedian,
      "neighborhood.ageLow": result.ageLow,
      "neighborhood.ageHigh": result.ageHigh,
      "neighborhood.agePredominant": result.ageMedian,
    });
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null));
}
