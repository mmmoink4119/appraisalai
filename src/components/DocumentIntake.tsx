"use client";

import { useState } from "react";
import type { Property } from "@/lib/appraisal";
import type { ExtractedField } from "@/lib/extraction";
import { FIELD_BY_KEY, formatValue, type ReportData, type ReportValue } from "@/lib/report";
import type { UploadedDocument } from "@/app/api/extract-report/route";
import { PROPERTY_GROUPS, RECORD_GROUP } from "./fields";

const SECTION_LABELS: Record<string, string> = {
  subject: "Subject", assignment: "Assignment", contract: "Contract", site: "Site", improvements: "Improvements",
  neighborhood: "Neighborhood", sales: "Sales comparison", cost: "Cost approach", income: "Income approach",
  reconciliation: "Reconciliation", appraiser: "Appraiser",
};
const SUBJECT_FIELDS = new Map([...PROPERTY_GROUPS, RECORD_GROUP].flatMap((g) => g.fields).map((f) => [f.key as string, f]));
const MAX_BYTES = 20 * 1024 * 1024;

export function fieldLabel(key: string) {
  const [section, name] = key.split(".");
  const label = section === "subject" ? SUBJECT_FIELDS.get(name)?.label ?? name : FIELD_BY_KEY.get(key)?.label ?? key;
  return { section: SECTION_LABELS[section] ?? section, label };
}

function display(key: string, value: ReportValue | undefined) {
  const field = FIELD_BY_KEY.get(key);
  if (field) return formatValue(field, value);
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (/\.(condition|quality)$/.test(key)) return `${key.endsWith("condition") ? "C" : "Q"}${value}`;
  return typeof value === "number" ? value.toLocaleString("en-US") : value;
}

function readFile(file: File): Promise<UploadedDocument> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result);
      if (!isPdf && !isImage) return resolve({ name: file.name, kind: "text", mediaType: "text/plain", data: result });
      resolve({
        name: file.name,
        kind: isPdf ? "pdf" : "image",
        mediaType: isPdf ? "application/pdf" : file.type,
        data: result.slice(result.indexOf(",") + 1),
      });
    };
    if (isPdf || isImage) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

export default function DocumentIntake({
  subject,
  report,
  onApply,
}: {
  subject: Property;
  report: ReportData;
  onApply: (fields: ExtractedField[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<ExtractedField[] | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<number | null>(null);

  const current = (key: string): ReportValue | undefined =>
    key.startsWith("subject.") ? (subject as Record<string, ReportValue>)[key.slice(8)] : report[key];

  const addFiles = (list: FileList | null) => {
    if (list) setFiles((prev) => [...prev, ...Array.from(list).filter((f) => !prev.some((p) => p.name === f.name))]);
  };

  const read = async () => {
    setBusy(true);
    setError(null);
    setFound(null);
    setApplied(null);
    try {
      if (files.reduce((sum, f) => sum + f.size, 0) > MAX_BYTES) throw new Error("Those files are over 20 MB together. Try fewer at a time.");
      const documents = await Promise.all(files.map(readFile));
      if (text.trim()) documents.push({ name: "Pasted text", kind: "text", mediaType: "text/plain", data: text });
      const res = await fetch("/api/extract-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't read the documents");
      if (!body.fields.length) throw new Error("No report fields found in these documents.");
      setFound(body.fields);
      setSkip(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const chosen = found?.filter((f) => !skip.has(f.key)) ?? [];

  return (
    <section className="card">
      <h2 className="text-lg font-semibold">Fill from documents</h2>
      <p className="mt-0.5 text-sm text-muted">
        Add the order or engagement letter, the agreement of sale, tax records or your inspection notes. AI reads them and
        fills the matching fields across the whole report. You review every value before it goes in.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label
          className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-accent-soft/40 px-4 py-6 text-center hover:border-accent"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <span className="text-sm font-medium text-accent">Choose files or drop them here</span>
          <span className="text-xs text-muted">PDF, photos (JPEG, PNG) or text files</span>
          <input
            type="file"
            multiple
            accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,image/*,text/plain"
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="block">
          <span className="label">Or paste text: an email from the lender, your inspection notes</span>
          <textarea
            className="input min-h-32"
            placeholder="e.g. Purchase, contract $249,900 dated 8/14/2026, seller paying $6,000 toward closing costs. Lender: Example Bank. Borrower: Jane Doe. Owner occupied."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {files.map((file) => (
            <li key={file.name} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1 text-sm">
              <span className="max-w-56 truncate">{file.name}</span>
              <button
                className="text-muted hover:text-danger"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles((prev) => prev.filter((f) => f !== file))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={busy || (!files.length && !text.trim())} onClick={read}>
          {busy ? "Reading…" : "Read documents"}
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
        {applied != null && <span className="text-sm text-accent">Filled {applied} fields.</span>}
      </div>

      {found && applied == null && (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Found {found.length} fields. Untick any you don&apos;t want.</span>
            <button
              className="btn btn-primary"
              disabled={!chosen.length}
              onClick={() => {
                onApply(chosen);
                setApplied(chosen.length);
                setFiles([]);
                setText("");
              }}
            >
              Fill {chosen.length} fields
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs text-muted">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">From the document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {found.map((item) => {
                  const { section, label } = fieldLabel(item.key);
                  const before = display(item.key, current(item.key));
                  const after = display(item.key, item.value);
                  return (
                    <tr key={item.key} className={skip.has(item.key) ? "opacity-50" : ""}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Use ${label}`}
                          checked={!skip.has(item.key)}
                          onChange={() =>
                            setSkip((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.key)) next.delete(item.key);
                              else next.add(item.key);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="block text-xs text-muted">{section}</span>
                        {label}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="font-medium">{after}</span>
                        {before && before !== after && <span className="block text-xs text-warn">Replaces {before}</span>}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-muted">{item.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
