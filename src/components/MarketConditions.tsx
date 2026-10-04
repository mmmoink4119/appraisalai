"use client";

import { useState } from "react";
import { parseCsv } from "@/lib/csvImport";
import { type MarketResult, marketConditions, marketFields, marketRecords } from "@/lib/market";
import {
  MARKET_GROUPS,
  MC_PERIODS,
  MC_ROWS,
  TRENDS,
  type ReportData,
  type ReportValue,
  formatValue,
  mcKey,
} from "@/lib/report";
import ReportFields from "./ReportFields";

function effectiveDate(report: ReportData) {
  const v = report["assignment.effectiveDate"];
  const m = typeof v === "string" ? v.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export default function MarketConditions({
  report,
  onChange,
  onFill,
}: {
  report: ReportData;
  onChange: (key: string, value: ReportValue) => void;
  onFill: (fields: ReportData) => void;
}) {
  const [result, setResult] = useState<MarketResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeNeighborhood, setIncludeNeighborhood] = useState(true);
  const [filled, setFilled] = useState(false);
  const effective = effectiveDate(report);
  const hasEffective = typeof report["assignment.effectiveDate"] === "string";

  const load = async (file: File) => {
    setError(null);
    setResult(null);
    setFilled(false);
    setFileName(file.name);
    const rows = parseCsv(await file.text()).filter((r) => r.some((c) => c.trim()));
    if (rows.length < 2) return setError("That file has no rows.");
    const { records, missing } = marketRecords(rows[0], rows.slice(1));
    if (missing.length) return setError(`The export is missing columns for: ${missing.join(", ")}.`);
    setResult(marketConditions(records, effective));
  };

  return (
    <>
      <section className="card">
        <h2 className="text-lg font-semibold">Market conditions (1004MC)</h2>
        <p className="mt-0.5 text-sm text-muted">
          Upload an MLS export of the subject&apos;s market: every sale from the last 12 months plus the current listings. The
          app counts sales and listings for each period and works out absorption, months of supply, medians and the trend.
          Periods count back from {hasEffective ? "the effective date" : "today (set the effective date on the Assignment step)"},{" "}
          {effective.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="btn btn-primary cursor-pointer">
            {fileName ? "Choose another export" : "Choose MLS export (CSV)"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) load(file);
                e.target.value = "";
              }}
            />
          </label>
          {fileName && <span className="text-sm text-muted">{fileName}</span>}
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>

        {result && (
          <div className="mt-5 space-y-3">
            <p className="text-sm">
              Found <b>{result.sales12}</b> sales in the last 12 months and <b>{result.listingsNow}</b> current listings.
              {result.sales12 < 6 && " That's a small sample; a wider search gives steadier figures."}
            </p>
            <MarketTable data={marketFields(result, { includeNeighborhood: false })} readOnly />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={includeNeighborhood} onChange={(e) => setIncludeNeighborhood(e.target.checked)} />
              <span>
                Also fill the neighborhood price and age ranges and the competing listing and sale counts on the Sales comparison
                step. Untick this if the export covers more than the subject&apos;s neighborhood.
              </span>
            </label>
            <div className="flex items-center gap-3">
              <button
                className="btn btn-primary"
                disabled={filled}
                onClick={() => {
                  onFill(marketFields(result, { includeNeighborhood }));
                  setFilled(true);
                }}
              >
                {filled ? "Filled" : "Fill market conditions"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Market conditions figures</h2>
        <MarketTable data={report} onChange={onChange} />
        <div className="mt-6">
          <ReportFields groups={MARKET_GROUPS} data={report} onChange={onChange} />
        </div>
      </section>
    </>
  );
}

function MarketTable({
  data,
  onChange,
  readOnly,
}: {
  data: ReportData;
  onChange?: (key: string, value: ReportValue) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 pr-3 font-medium">Inventory analysis</th>
            {MC_PERIODS.map((p) => (
              <th key={p.id} className="px-2 py-2 text-right font-medium">{p.label}</th>
            ))}
            <th className="py-2 pl-2 text-right font-medium">Overall trend</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {MC_ROWS.map((row) => (
            <tr key={row.id} className="border-b border-line/60">
              <td className="py-1.5 pr-3">{row.label}</td>
              {MC_PERIODS.map((p) => {
                const key = mcKey(row.id, p.id);
                const value = data[key];
                return (
                  <td key={p.id} className="px-2 py-1 text-right">
                    {readOnly ? (
                      (formatValue({ type: row.type }, value ?? null) || "—") + (row.id === "saleToList" && value != null ? "%" : "")
                    ) : (
                      <input
                        type="number"
                        aria-label={`${row.label}, ${p.label}`}
                        className="input w-28 text-right"
                        value={value == null ? "" : String(value)}
                        onChange={(e) => onChange?.(key, e.target.value === "" ? null : Number(e.target.value))}
                      />
                    )}
                  </td>
                );
              })}
              <td className="py-1 pl-2 text-right">
                {readOnly ? (
                  (data[mcKey(row.id, "trend")] as string | undefined) ?? "—"
                ) : (
                  <select
                    aria-label={`${row.label}, overall trend`}
                    className="input w-32"
                    value={(data[mcKey(row.id, "trend")] as string | null) ?? ""}
                    onChange={(e) => onChange?.(mcKey(row.id, "trend"), e.target.value || null)}
                  >
                    <option value="">—</option>
                    {TRENDS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
