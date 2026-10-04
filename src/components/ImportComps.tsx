"use client";

import { useState } from "react";
import type { Comp } from "@/lib/appraisal";
import {
  type ColumnMapping,
  type Transform,
  TRANSFORMS,
  guessMapping,
  headerSignature,
  parseCsv,
  rowToComp,
} from "@/lib/csvImport";

const MAPPINGS_KEY = "appraisalai-csv-mappings";

function loadSavedMapping(sig: string): ColumnMapping | null {
  try {
    const all = JSON.parse(localStorage.getItem(MAPPINGS_KEY) ?? "{}");
    return all[sig] ?? null;
  } catch {
    return null;
  }
}

function saveMapping(sig: string, mapping: ColumnMapping) {
  try {
    const all = JSON.parse(localStorage.getItem(MAPPINGS_KEY) ?? "{}");
    localStorage.setItem(MAPPINGS_KEY, JSON.stringify({ ...all, [sig]: mapping }));
  } catch {}
}

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function ImportComps({ onAdd }: { onAdd: (comps: Comp[]) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reset = () => {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping(null);
    setSelected(new Set());
    setNotice(null);
  };

  const onFile = async (file: File) => {
    reset();
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setNotice("That file has no data rows.");
      return;
    }
    const [head, ...data] = parsed;
    setFileName(file.name);
    setHeaders(head);
    setRows(data);

    const saved = loadSavedMapping(headerSignature(head));
    if (saved) {
      setMapping(saved);
      setNotice("Using the column mapping saved from your last import with this layout.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/map-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: head, sampleRows: data.slice(0, 5) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Column mapping failed");
      setMapping(body.mappings);
      setNotice("AI matched the CSV columns. Check the mapping below before adding comps.");
    } catch (e) {
      setMapping(guessMapping(head));
      setNotice(
        `${e instanceof Error ? e.message : String(e)} Matched columns by name instead; check the mapping below.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const comps = mapping ? rows.map((r) => rowToComp(headers, r, mapping)) : [];

  const toggle = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const updateMapping = (index: number, patch: Partial<ColumnMapping[number]>) =>
    setMapping((m) => m && m.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  const add = () => {
    if (!mapping) return;
    saveMapping(headerSignature(headers), mapping);
    onAdd([...selected].sort((a, b) => a - b).map((i) => comps[i]));
    reset();
  };

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold">Import from MLS</h2>
          <p className="text-sm text-muted">Upload the CSV export of an MLS search and pick the sales to use.</p>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-contrast"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        {busy && <span className="text-sm text-muted">Matching columns…</span>}
      </div>
      {notice && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm">{notice}</p>}

      {mapping && (
        <>
          <p className="text-sm">
            {fileName}: {rows.length} listings. Tick the ones to use as comps; rows without a sale price are
            active or pending listings.
          </p>
          <div className="max-h-80 overflow-auto rounded-lg border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 pl-3 pr-2"></th>
                  <th className="py-1 pr-3">Status</th>
                  <th className="py-1 pr-3">Address</th>
                  <th className="py-1 pr-3 text-right">Sale price</th>
                  <th className="py-1 pr-3">Sale date</th>
                  <th className="py-1 pr-3 text-right">GLA</th>
                  <th className="py-1 pr-3 text-right">Bd</th>
                  <th className="py-1 pr-3 text-right">Ba (F/H)</th>
                  <th className="py-1 pr-3 text-right">Built</th>
                  <th className="py-1 pr-3 text-right">DOM</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c, i) => (
                  <tr
                    key={i}
                    className={`cursor-pointer border-b border-line/60 ${selected.has(i) ? "bg-accent-soft" : "hover:bg-foreground/[0.03]"}`}
                    onClick={() => toggle(i)}
                  >
                    <td className="py-1.5 pl-3 pr-2">
                      <input type="checkbox" checked={selected.has(i)} readOnly />
                    </td>
                    <td className="py-1 pr-3">{c.status ?? "—"}</td>
                    <td className="py-1 pr-3">{c.address ?? "—"}</td>
                    <td className="py-1 pr-3 text-right">{money(c.salePrice)}</td>
                    <td className="py-1 pr-3">{c.saleDate ?? "—"}</td>
                    <td className="py-1 pr-3 text-right">{c.gla ?? "—"}</td>
                    <td className="py-1 pr-3 text-right">{c.bedrooms ?? "—"}</td>
                    <td className="py-1 pr-3 text-right">
                      {c.fullBaths ?? "—"}/{c.halfBaths ?? "—"}
                    </td>
                    <td className="py-1 pr-3 text-right">{c.yearBuilt ?? "—"}</td>
                    <td className="py-1 pr-3 text-right">{c.daysOnMarket ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details>
            <summary className="cursor-pointer text-sm">
              Column mapping ({mapping.filter((m) => m.column).length} of {mapping.length} fields matched)
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {mapping.map((m, i) => (
                <div key={m.field} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 text-muted">{m.field}</span>
                  <select
                    className="input"
                    value={m.column ?? ""}
                    onChange={(e) => updateMapping(i, { column: e.target.value || null })}
                  >
                    <option value="">— not in file</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <select
                    className="input w-40"
                    value={m.transform}
                    onChange={(e) => updateMapping(i, { transform: e.target.value as Transform })}
                  >
                    {TRANSFORMS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn"
              onClick={() =>
                setSelected(new Set(comps.flatMap((c, i) => (c.salePrice != null && c.saleDate ? [i] : []))))
              }
            >
              Select all closed sales
            </button>
            <button className="btn btn-primary" disabled={selected.size === 0} onClick={add}>
              Add {selected.size || ""} as comps
            </button>
            <button className="btn" onClick={reset}>Cancel</button>
          </div>
        </>
      )}
    </section>
  );
}
