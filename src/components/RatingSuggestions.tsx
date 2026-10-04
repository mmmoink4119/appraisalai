"use client";

import { useState } from "react";
import type { Comp, RatingSuggestion } from "@/lib/appraisal";

type Props = {
  comps: Comp[];
  onApply: (index: number, ratings: Pick<Comp, "condition" | "quality">) => void;
};

const rating = (prefix: "C" | "Q", n: number | null | undefined) => (n == null ? "—" : `${prefix}${n}`);

const CONFIDENCE_STYLE: Record<RatingSuggestion["confidence"], string> = {
  high: "bg-accent-soft text-accent",
  medium: "bg-foreground/10",
  low: "bg-warn/15 text-warn",
};

export default function RatingSuggestions({ comps, onApply }: Props) {
  const [suggestions, setSuggestions] = useState<RatingSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withRemarks = comps.flatMap((comp, index) => (comp.remarks?.trim() ? [{ index, comp }] : []));

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/suggest-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comps: withRemarks }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Suggestions failed");
      setSuggestions(body.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Only suggestions that still point at a comp and differ from what's entered.
  const rows = suggestions.filter((s) => comps[s.index]);
  const isApplied = (s: RatingSuggestion) =>
    (s.condition == null || comps[s.index].condition === s.condition) &&
    (s.quality == null || comps[s.index].quality === s.quality);
  const apply = (s: RatingSuggestion) => {
    const comp = comps[s.index];
    onApply(s.index, { condition: s.condition ?? comp.condition, quality: s.quality ?? comp.quality });
  };
  const pending = rows.filter((s) => !isApplied(s) && (s.condition != null || s.quality != null));

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Condition and quality</h2>
          <p className="mt-0.5 text-sm text-muted">
            Suggests UAD C1-C6 and Q1-Q6 ratings from each comp&apos;s listing remarks. Nothing changes until you apply
            it.
          </p>
        </div>
        <button className="btn btn-primary" disabled={busy || withRemarks.length === 0} onClick={run}>
          {busy ? "Reading remarks…" : `Suggest ratings${withRemarks.length ? ` for ${withRemarks.length}` : ""}`}
        </button>
      </div>
      {withRemarks.length === 0 && (
        <p className="text-sm text-muted">
          No comps have listing remarks yet. Remarks come in with the MLS import, or paste them into a comp.
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="divide-y divide-line rounded-lg border border-line">
            {rows.map((s) => {
              const comp = comps[s.index];
              const applied = isApplied(s);
              return (
                <div key={s.index} className="flex flex-wrap items-start gap-x-6 gap-y-2 px-4 py-3">
                  <div className="min-w-44 flex-1">
                    <div className="text-xs text-muted">Comp {s.index + 1}</div>
                    <div className="font-medium">{comp.address ?? "—"}</div>
                  </div>
                  <div className="w-28 text-sm">
                    <div className="text-xs text-muted">Entered</div>
                    {rating("C", comp.condition)} / {rating("Q", comp.quality)}
                  </div>
                  <div className="w-36 text-sm">
                    <div className="text-xs text-muted">Suggested</div>
                    <span className="font-semibold">
                      {rating("C", s.condition)} / {rating("Q", s.quality)}
                    </span>{" "}
                    <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${CONFIDENCE_STYLE[s.confidence]}`}>
                      {s.confidence}
                    </span>
                  </div>
                  <p className="min-w-64 flex-[2] text-sm text-muted">{s.reason}</p>
                  <button
                    className="btn"
                    disabled={applied || (s.condition == null && s.quality == null)}
                    onClick={() => apply(s)}
                  >
                    {applied ? "Applied" : "Apply"}
                  </button>
                </div>
              );
            })}
          </div>
          {pending.length > 1 && (
            <button className="btn" onClick={() => pending.forEach(apply)}>
              Apply all {pending.length}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
