"use client";

import { useEffect, useState } from "react";
import {
  type AdjustmentRates,
  type Comp,
  type Property,
  GROSS_ADJ_WARN,
  NET_ADJ_WARN,
  SALE_TYPES,
  adjustComp,
  defaultRates,
  emptyComp,
  emptyProperty,
} from "@/lib/appraisal";
import ImportComps from "./ImportComps";

type Draft = { subject: Property; comps: Comp[]; rates: AdjustmentRates };

const STORAGE_KEY = "appraisalai-draft";

type FieldDef = { key: keyof Comp; label: string; type: "text" | "number" | "bool" | "select"; options?: readonly string[] };

const PROPERTY_FIELDS: FieldDef[] = [
  { key: "address", label: "Address", type: "text" },
  { key: "city", label: "City", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "zip", label: "Zip", type: "text" },
  { key: "county", label: "County", type: "text" },
  { key: "parcelNumber", label: "Parcel #", type: "text" },
  { key: "design", label: "Design (style)", type: "text" },
  { key: "yearBuilt", label: "Year built", type: "number" },
  { key: "gla", label: "GLA (sq ft)", type: "number" },
  { key: "lotSizeSqFt", label: "Site (sq ft)", type: "number" },
  { key: "bedrooms", label: "Bedrooms", type: "number" },
  { key: "fullBaths", label: "Full baths", type: "number" },
  { key: "halfBaths", label: "Half baths", type: "number" },
  { key: "basementSqFt", label: "Basement (sq ft)", type: "number" },
  { key: "basementFinishedSqFt", label: "Finished bsmt (sq ft)", type: "number" },
  { key: "garageSpaces", label: "Garage spaces", type: "number" },
  { key: "condition", label: "Condition (C1-C6)", type: "number" },
  { key: "quality", label: "Quality (Q1-Q6)", type: "number" },
  { key: "fireplaces", label: "Fireplaces", type: "number" },
  { key: "pool", label: "Pool", type: "bool" },
  { key: "heatingCooling", label: "Heating/cooling", type: "text" },
  { key: "view", label: "View", type: "text" },
];

const SALE_FIELDS: FieldDef[] = [
  { key: "status", label: "MLS status", type: "text" },
  { key: "salePrice", label: "Sale price", type: "number" },
  { key: "saleDate", label: "Sale date", type: "text" },
  { key: "listPrice", label: "List price", type: "number" },
  { key: "daysOnMarket", label: "Days on market", type: "number" },
  { key: "saleType", label: "Sale type", type: "select", options: SALE_TYPES },
  { key: "financing", label: "Financing", type: "text" },
  { key: "concessions", label: "Concessions ($)", type: "number" },
  { key: "dataSource", label: "Data source", type: "text" },
];

const RATE_LABELS: Record<keyof AdjustmentRates, string> = {
  glaPerSqFt: "GLA $/sq ft",
  agePerYear: "Age $/year",
  fullBath: "Full bath",
  halfBath: "Half bath",
  garageSpace: "Garage $/space",
  basementPerSqFt: "Basement $/sq ft",
  basementFinishedPerSqFt: "Finished bsmt $/sq ft",
  lotPerSqFt: "Site $/sq ft",
  conditionStep: "Condition $/step",
  qualityStep: "Quality $/step",
  fireplace: "Fireplace",
  pool: "Pool",
};

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

function initialDraft(): Draft {
  return { subject: emptyProperty(), comps: [emptyComp(), emptyComp(), emptyComp()], rates: defaultRates };
}

function loadDraft(): Draft {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...initialDraft(), ...JSON.parse(saved) };
  } catch {}
  return initialDraft();
}

// Rendered client-only (see page.tsx), so the browser-saved draft can be
// read during the first render.
export default function Worksheet() {
  const [draft, setDraft] = useState<Draft>(loadDraft);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  const setSubject = (subject: Property) => setDraft((d) => ({ ...d, subject }));
  const setComp = (i: number, comp: Comp) =>
    setDraft((d) => ({ ...d, comps: d.comps.map((c, j) => (j === i ? comp : c)) }));

  // Imported comps fill empty comp slots first, then get appended.
  const addComps = (incoming: Comp[]) =>
    setDraft((d) => {
      const queue = [...incoming];
      const comps = d.comps.map((c) => (isEmpty(c) && queue.length ? queue.shift()! : c));
      return { ...d, comps: [...comps, ...queue] };
    });

  const results = draft.comps.map((c) => adjustComp(draft.subject, c, draft.rates));
  const adjusted = results.map((r) => r.adjustedPrice).filter((n): n is number => n != null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `appraisal-${draft.subject.address ?? "draft"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Appraisal AI</h1>
          <p className="text-sm opacity-70">Residential report worksheet (URAR / Form 1004)</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={exportJson}>Export JSON</button>
          <button
            className="btn"
            onClick={() => confirm("Clear the whole report?") && setDraft(initialDraft())}
          >
            New report
          </button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Subject property</h2>
        <PasteToFill kind="subject" onFill={(f) => setSubject({ ...draft.subject, ...nonNull(f) })} />
        <FieldGrid fields={PROPERTY_FIELDS} value={draft.subject} onChange={(v) => setSubject(v as Property)} />
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Comparable sales</h2>
          <button
            className="btn"
            onClick={() => setDraft((d) => ({ ...d, comps: [...d.comps, emptyComp()] }))}
          >
            Add comp
          </button>
        </div>
        <ImportComps onAdd={addComps} />
        {draft.comps.map((comp, i) => (
          <details key={i} open={i === 0} className="rounded-lg border border-current/15 p-4">
            <summary className="cursor-pointer font-medium">
              Comp {i + 1}: {comp.address ?? "not filled"} · {money(comp.salePrice)}
            </summary>
            <div className="mt-4 space-y-3">
              <PasteToFill kind="comp" onFill={(f) => setComp(i, { ...comp, ...nonNull(f) })} />
              <FieldGrid fields={[...SALE_FIELDS, ...PROPERTY_FIELDS]} value={comp} onChange={(v) => setComp(i, v)} />
              <button
                className="text-sm text-red-600 underline"
                onClick={() => setDraft((d) => ({ ...d, comps: d.comps.filter((_, j) => j !== i) }))}
              >
                Remove comp
              </button>
            </div>
          </details>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Adjustment rates</h2>
        <p className="text-sm opacity-70">Placeholder values. Set these from paired sales for the subject&apos;s market.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(RATE_LABELS) as (keyof AdjustmentRates)[]).map((k) => (
            <label key={k} className="text-sm">
              <span className="block opacity-70">{RATE_LABELS[k]}</span>
              <input
                type="number"
                className="input"
                value={draft.rates[k]}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, rates: { ...d.rates, [k]: Number(e.target.value) || 0 } }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sales comparison grid</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-current/20 text-left">
                <th className="py-2 pr-4">Adjustment</th>
                {draft.comps.map((_, i) => (
                  <th key={i} className="py-2 pr-4 text-right">Comp {i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-current/10">
                <td className="py-1 pr-4">Sale price</td>
                {draft.comps.map((c, i) => (
                  <td key={i} className="py-1 pr-4 text-right">{money(c.salePrice)}</td>
                ))}
              </tr>
              {results[0]?.lines.map((line, row) => (
                <tr key={line.label} className="border-b border-current/10">
                  <td className="py-1 pr-4">{line.label}</td>
                  {results.map((r, i) => (
                    <td key={i} className="py-1 pr-4 text-right tabular-nums">
                      {r.lines[row].amount === 0 ? "" : money(r.lines[row].amount)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-current/10">
                <td className="py-1 pr-4">Net adj.</td>
                {results.map((r, i) => (
                  <td key={i} className={`py-1 pr-4 text-right ${warn(r.netPct, NET_ADJ_WARN)}`}>
                    {money(r.net)} ({pct(r.netPct)})
                  </td>
                ))}
              </tr>
              <tr className="border-b border-current/10">
                <td className="py-1 pr-4">Gross adj.</td>
                {results.map((r, i) => (
                  <td key={i} className={`py-1 pr-4 text-right ${warn(r.grossPct, GROSS_ADJ_WARN)}`}>
                    {money(r.gross)} ({pct(r.grossPct)})
                  </td>
                ))}
              </tr>
              <tr className="font-semibold">
                <td className="py-2 pr-4">Adjusted price</td>
                {results.map((r, i) => (
                  <td key={i} className="py-2 pr-4 text-right">{money(r.adjustedPrice)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {adjusted.length > 0 && (
          <p className="text-sm">
            Adjusted range {money(Math.min(...adjusted))} to {money(Math.max(...adjusted))}, mean{" "}
            {money(adjusted.reduce((a, b) => a + b, 0) / adjusted.length)}. Highlighted cells exceed the
            traditional {NET_ADJ_WARN * 100}% net / {GROSS_ADJ_WARN * 100}% gross guidelines.
          </p>
        )}
      </section>
    </main>
  );
}

function warn(value: number | null, limit: number) {
  return value != null && Math.abs(value) > limit ? "text-amber-600 font-semibold" : "";
}

function isEmpty(comp: Comp) {
  return Object.values(comp).every((v) => v == null);
}

// Only let extraction overwrite fields it actually found.
function nonNull<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null)) as Partial<T>;
}

function PasteToFill({ kind, onFill }: { kind: "subject" | "comp"; onFill: (fields: Comp) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      onFill(data.fields);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        className="input min-h-24"
        placeholder="Paste an MLS listing sheet, public record, or notes and let AI fill the fields below"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={busy || !text.trim()} onClick={run}>
          {busy ? "Extracting…" : "Fill from text"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function FieldGrid<T extends Property>({
  fields,
  value,
  onChange,
}: {
  fields: FieldDef[];
  value: T;
  onChange: (v: T) => void;
}) {
  const record = value as Record<string, unknown>;
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {fields
        .filter((f) => f.key in record)
        .map((f) => (
          <label key={f.key} className="text-sm">
            <span className="block opacity-70">{f.label}</span>
            {f.type === "bool" ? (
              <select
                className="input"
                value={record[f.key] == null ? "" : String(record[f.key])}
                onChange={(e) => set(f.key, e.target.value === "" ? null : e.target.value === "true")}
              >
                <option value="">—</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : f.type === "select" ? (
              <select
                className="input"
                value={(record[f.key] as string | null) ?? ""}
                onChange={(e) => set(f.key, e.target.value || null)}
              >
                <option value="">—</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type}
                className="input"
                value={(record[f.key] as string | number | null) ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  set(f.key, raw === "" ? null : f.type === "number" ? Number(raw) : raw);
                }}
              />
            )}
          </label>
        ))}
    </div>
  );
}
