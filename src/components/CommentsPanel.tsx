"use client";

import { useState } from "react";
import {
  type AdjustmentRates,
  type Comments,
  type Comp,
  type Property,
  COMMENT_SECTIONS,
} from "@/lib/appraisal";
import type { ReportData } from "@/lib/report";

type Props = {
  subject: Property;
  comps: Comp[];
  rates: AdjustmentRates;
  report: ReportData;
  notes: string;
  comments: Comments;
  onNotes: (notes: string) => void;
  onComments: (comments: Comments) => void;
};

export default function CommentsPanel({ subject, comps, rates, report, notes, comments, onNotes, onComments }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const draft = async () => {
    const hasText = Object.values(comments).some((c) => c.trim());
    if (hasText && !confirm("Replace the current comments with a new draft?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, comps, rates, report, notes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Drafting failed");
      onComments(body.comments);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="label">
          Your notes for the draft: neighborhood boundaries, market trend, inspection observations, final value
        </span>
        <textarea
          className="input min-h-24"
          placeholder="e.g. Holmesburg, bounded by Pennypack Park, I-95, Cottman Ave. Values stable, typical marketing time under 60 days. Subject has updated kitchen, original baths."
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy} onClick={draft}>
          {busy ? "Drafting…" : "Draft comments"}
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
      <p className="text-sm text-muted">
        Drafts use only what is in the report so far and your notes. Anything missing shows as a [bracketed placeholder] to fill in.
      </p>
      {COMMENT_SECTIONS.map(({ key, label }) => (
        <label key={key} className="block">
          <span className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <button
              type="button"
              className="text-xs font-medium text-accent hover:underline disabled:opacity-40"
              disabled={!comments[key].trim()}
              onClick={() => copy(key, comments[key])}
            >
              {copied === key ? "Copied" : "Copy"}
            </button>
          </span>
          <textarea
            className="input min-h-28"
            value={comments[key]}
            onChange={(e) => onComments({ ...comments, [key]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}
