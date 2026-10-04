"use client";

import { useState } from "react";
import type { Property } from "@/lib/appraisal";
import { money } from "./fields";

type Match = { label: string; fields: Partial<Property>; notes: string[] };

const PREVIEW: { key: keyof Property; label: string; format?: (v: unknown) => string }[] = [
  { key: "yearBuilt", label: "Year built" },
  { key: "gla", label: "GLA", format: (v) => `${Number(v).toLocaleString()} sq ft` },
  { key: "lotSizeSqFt", label: "Site", format: (v) => `${Number(v).toLocaleString()} sq ft` },
  { key: "bedrooms", label: "Bedrooms" },
  { key: "fullBaths", label: "Baths" },
  { key: "garageSpaces", label: "Garage" },
  { key: "zoning", label: "Zoning" },
  { key: "censusTract", label: "Census tract" },
  { key: "assessedValue", label: "Assessed", format: (v) => money(v as number) },
  { key: "priorSalePrice", label: "Last sale", format: (v) => money(v as number) },
  { key: "priorSaleDate", label: "Sold" },
];

export default function RecordLookup({ subject, onFill }: { subject: Property; onFill: (f: Partial<Property>) => void }) {
  const [query, setQuery] = useState(subject.parcelNumber ?? subject.address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [picked, setPicked] = useState(0);
  const [filled, setFilled] = useState(false);

  const lookup = async () => {
    setBusy(true);
    setError(null);
    setMatches(null);
    setFilled(false);
    try {
      const res = await fetch("/api/public-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Lookup failed");
      if (body.matches.length === 0) throw new Error("No Philadelphia property matches that address or parcel.");
      setMatches(body.matches);
      setPicked(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const match = matches?.[picked];

  return (
    <div className="mb-6 rounded-lg border border-line px-4 py-3">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="label">Philadelphia property records: address or parcel number</span>
          <input
            id="record-query"
            className="input"
            placeholder="4625 Lansing St or 651178900"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={busy || !query.trim()} type="submit">
          {busy ? "Looking up…" : "Look up"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {matches && match && (
        <div className="mt-4 space-y-3">
          {matches.length > 1 && (
            <label className="block">
              <span className="label">{matches.length} matches</span>
              <select className="input" value={picked} onChange={(e) => setPicked(Number(e.target.value))}>
                {matches.map((m, i) => (
                  <option key={m.label} value={i}>{m.label}</option>
                ))}
              </select>
            </label>
          )}
          <div>
            <div className="font-medium">{match.fields.address}</div>
            <div className="text-xs text-muted">
              Parcel {match.fields.parcelNumber}
              {match.fields.ownerOfRecord ? ` · Owner of record: ${match.fields.ownerOfRecord}` : ""}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-6">
            {PREVIEW.filter((p) => match.fields[p.key] != null).map((p) => (
              <div key={p.key}>
                <dt className="text-xs text-muted">{p.label}</dt>
                <dd className="tabular-nums">{p.format ? p.format(match.fields[p.key]) : String(match.fields[p.key])}</dd>
              </div>
            ))}
          </dl>
          {match.notes.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
              {match.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <button
            className="btn btn-primary"
            disabled={filled}
            onClick={() => {
              onFill(match.fields);
              setFilled(true);
            }}
          >
            {filled ? "Filled from city record" : "Fill subject from this record"}
          </button>
        </div>
      )}
    </div>
  );
}
