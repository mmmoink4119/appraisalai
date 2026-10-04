"use client";

import { useEffect, useState } from "react";
import {
  type AdjustmentRates,
  type Comments,
  type Comp,
  type Property,
  GROSS_ADJ_WARN,
  NET_ADJ_WARN,
  adjustComp,
  defaultRates,
  emptyComments,
  emptyComp,
  emptyProperty,
} from "@/lib/appraisal";
import CommentsPanel from "./CommentsPanel";
import ImportComps from "./ImportComps";
import { FieldGroups, PROPERTY_GROUPS, RATE_LABELS, SALE_GROUP, filledCount, money, pct } from "./fields";

type Draft = { subject: Property; comps: Comp[]; rates: AdjustmentRates; notes: string; comments: Comments };

const STORAGE_KEY = "appraisalai-draft";
const STEP_KEY = "appraisalai-step";

const STEPS = [
  { id: "subject", label: "Subject" },
  { id: "comps", label: "Comparables" },
  { id: "grid", label: "Adjustments" },
  { id: "comments", label: "Comments" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

function initialDraft(): Draft {
  return {
    subject: emptyProperty(),
    comps: [emptyComp(), emptyComp(), emptyComp()],
    rates: defaultRates,
    notes: "",
    comments: emptyComments(),
  };
}

function loadDraft(): Draft {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...initialDraft(), ...JSON.parse(saved) };
  } catch {}
  return initialDraft();
}

function loadStep(): StepId {
  try {
    const saved = localStorage.getItem(STEP_KEY);
    if (STEPS.some((s) => s.id === saved)) return saved as StepId;
  } catch {}
  return "subject";
}

// Rendered client-only (see page.tsx), so the browser-saved draft can be
// read during the first render.
export default function Worksheet() {
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [step, setStep] = useState<StepId>(loadStep);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  const goTo = (id: StepId) => {
    setStep(id);
    try {
      localStorage.setItem(STEP_KEY, id);
    } catch {}
    window.scrollTo({ top: 0 });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `appraisal-${draft.subject.address ?? "draft"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const usedComps = draft.comps.filter((c) => c.salePrice != null).length;
  const subjectProgress = filledCount(draft.subject, PROPERTY_GROUPS);
  const draftedComments = Object.values(draft.comments).filter((c) => c.trim()).length;
  const hints: Record<StepId, string> = {
    subject: `${subjectProgress.filled}/${subjectProgress.total} fields`,
    comps: `${usedComps} with a sale price`,
    grid: usedComps ? `${usedComps} adjusted` : "needs comps",
    comments: `${draftedComments}/5 drafted`,
  };
  const index = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-contrast">
              A
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Appraisal AI</div>
              <div className="truncate text-xs text-muted">
                {draft.subject.address ?? "New report"} · URAR / UAD 3.6
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={exportJson}>Export</button>
            <button className="btn" onClick={() => confirm("Clear the whole report?") && setDraft(initialDraft())}>
              New report
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ol className="flex min-w-max gap-1">
            {STEPS.map((s, i) => {
              const active = s.id === step;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => goTo(s.id)}
                    className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-left transition ${
                      active ? "border-accent" : "border-transparent hover:border-line"
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                        active ? "bg-accent text-accent-contrast" : "bg-foreground/10 text-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span>
                      <span className={`block text-sm font-medium ${active ? "" : "text-muted"}`}>{s.label}</span>
                      <span className="block text-xs text-muted">{hints[s.id]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
        {step === "subject" && <SubjectStep draft={draft} setDraft={setDraft} />}
        {step === "comps" && <CompsStep draft={draft} setDraft={setDraft} />}
        {step === "grid" && <GridStep draft={draft} setDraft={setDraft} />}
        {step === "comments" && (
          <section className="card">
            <StepHeading
              title="Comments"
              detail="Add your notes, then draft the report comments from the worksheet. Edit anything before copying it into TOTAL."
            />
            <CommentsPanel
              subject={draft.subject}
              comps={draft.comps}
              rates={draft.rates}
              notes={draft.notes}
              comments={draft.comments}
              onNotes={(notes) => setDraft((d) => ({ ...d, notes }))}
              onComments={(comments) => setDraft((d) => ({ ...d, comments }))}
            />
          </section>
        )}

        <div className="flex justify-between">
          {index > 0 ? (
            <button className="btn" onClick={() => goTo(STEPS[index - 1].id)}>← {STEPS[index - 1].label}</button>
          ) : (
            <span />
          )}
          {index < STEPS.length - 1 && (
            <button className="btn btn-primary" onClick={() => goTo(STEPS[index + 1].id)}>
              {STEPS[index + 1].label} →
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

type StepProps = { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> };

function StepHeading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {detail && <p className="mt-0.5 text-sm text-muted">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function SubjectStep({ draft, setDraft }: StepProps) {
  const setSubject = (subject: Property) => setDraft((d) => ({ ...d, subject }));
  return (
    <section className="card">
      <StepHeading title="Subject property" detail="The property being appraised." />
      <PasteToFill kind="subject" onFill={(f) => setSubject({ ...draft.subject, ...nonNull(f) })} />
      <FieldGroups groups={PROPERTY_GROUPS} value={draft.subject} onChange={setSubject} />
    </section>
  );
}

function CompsStep({ draft, setDraft }: StepProps) {
  const [open, setOpen] = useState<number | null>(null);
  const setComp = (i: number, comp: Comp) =>
    setDraft((d) => ({ ...d, comps: d.comps.map((c, j) => (j === i ? comp : c)) }));

  // Imported comps fill empty comp slots first, then get appended.
  const addComps = (incoming: Comp[]) =>
    setDraft((d) => {
      const queue = [...incoming];
      const comps = d.comps.map((c) => (isEmpty(c) && queue.length ? queue.shift()! : c));
      return { ...d, comps: [...comps, ...queue] };
    });

  return (
    <>
      <ImportComps onAdd={addComps} />
      <section className="card">
        <StepHeading
          title="Comparable sales"
          detail="Click a comp to edit its details."
          action={
            <button
              className="btn"
              onClick={() => {
                setDraft((d) => ({ ...d, comps: [...d.comps, emptyComp()] }));
                setOpen(draft.comps.length);
              }}
            >
              + Add comp
            </button>
          }
        />
        <div className="divide-y divide-line rounded-lg border border-line">
          {draft.comps.map((comp, i) => (
            <div key={i}>
              <button
                className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-left hover:bg-foreground/[0.03]"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="min-w-40 flex-1 font-medium">
                  {comp.address ?? <span className="text-muted">Empty comp</span>}
                </span>
                <CompStat label="Sale price" value={money(comp.salePrice)} />
                <CompStat label="Sold" value={comp.saleDate ?? "—"} />
                <CompStat label="GLA" value={comp.gla?.toLocaleString() ?? "—"} />
                <CompStat label="Bd / Ba" value={`${comp.bedrooms ?? "—"} / ${comp.fullBaths ?? "—"}.${comp.halfBaths ?? 0}`} />
                <span className="text-muted">{open === i ? "▴" : "▾"}</span>
              </button>
              {open === i && (
                <div className="space-y-5 border-t border-line bg-background/50 px-4 py-5">
                  <PasteToFill kind="comp" onFill={(f) => setComp(i, { ...comp, ...nonNull(f) })} />
                  <FieldGroups groups={[SALE_GROUP, ...PROPERTY_GROUPS]} value={comp} onChange={(v) => setComp(i, v)} />
                  <button
                    className="text-sm text-danger hover:underline"
                    onClick={() => {
                      setDraft((d) => ({ ...d, comps: d.comps.filter((_, j) => j !== i) }));
                      setOpen(null);
                    }}
                  >
                    Remove comp
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function CompStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="w-24 text-sm">
      <span className="block text-xs text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function GridStep({ draft, setDraft }: StepProps) {
  const comps = draft.comps.map((c, i) => ({ comp: c, n: i + 1 })).filter(({ comp }) => comp.salePrice != null);
  const results = comps.map(({ comp }) => adjustComp(draft.subject, comp, draft.rates));
  const adjusted = results.map((r) => r.adjustedPrice).filter((n): n is number => n != null);
  const mean = adjusted.length ? adjusted.reduce((a, b) => a + b, 0) / adjusted.length : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Comps adjusted" value={String(comps.length)} />
        <Stat label="Low" value={adjusted.length ? money(Math.min(...adjusted)) : "—"} />
        <Stat label="High" value={adjusted.length ? money(Math.max(...adjusted)) : "—"} />
        <Stat label="Mean" value={money(mean)} />
      </div>

      <section className="card">
        <StepHeading
          title="Sales comparison grid"
          detail={`Adjustments bring each comp in line with the subject. Amber cells exceed the traditional ${
            NET_ADJ_WARN * 100
          }% net / ${GROSS_ADJ_WARN * 100}% gross guidelines.`}
        />
        {comps.length === 0 ? (
          <p className="text-sm text-muted">Add comparables with a sale price to see adjustments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="sticky left-0 bg-surface py-2 pr-4 font-medium text-muted">Adjustment</th>
                  {comps.map(({ comp, n }) => (
                    <th key={n} className="py-2 pl-4 text-right font-medium">
                      <span className="block text-xs text-muted">Comp {n}</span>
                      <span className="block truncate">{comp.address ?? "—"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <tr className="border-b border-line">
                  <td className="sticky left-0 bg-surface py-2 pr-4">Sale price</td>
                  {comps.map(({ comp, n }) => (
                    <td key={n} className="py-2 pl-4 text-right font-medium">{money(comp.salePrice)}</td>
                  ))}
                </tr>
                {results[0].lines.map((line, row) => (
                  <tr key={line.label} className="border-b border-line/60">
                    <td className="sticky left-0 bg-surface py-1.5 pr-4 text-muted">{line.label}</td>
                    {results.map((r, i) => {
                      const amount = r.lines[row].amount;
                      return (
                        <td
                          key={i}
                          className={`py-1.5 pl-4 text-right ${amount > 0 ? "text-accent" : amount < 0 ? "" : "text-muted/50"}`}
                        >
                          {amount === 0 ? "·" : `${amount > 0 ? "+" : ""}${money(amount)}`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-line">
                  <td className="sticky left-0 bg-surface py-2 pr-4">Net adj.</td>
                  {results.map((r, i) => (
                    <td key={i} className={`py-2 pl-4 text-right ${warn(r.netPct, NET_ADJ_WARN)}`}>
                      {money(r.net)} <span className="text-xs text-muted">({pct(r.netPct)})</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky left-0 bg-surface py-2 pr-4">Gross adj.</td>
                  {results.map((r, i) => (
                    <td key={i} className={`py-2 pl-4 text-right ${warn(r.grossPct, GROSS_ADJ_WARN)}`}>
                      {money(r.gross)} <span className="text-xs text-muted">({pct(r.grossPct)})</span>
                    </td>
                  ))}
                </tr>
                <tr className="bg-accent-soft">
                  <td className="sticky left-0 rounded-l-md bg-accent-soft px-2 py-2.5 font-semibold">Adjusted price</td>
                  {results.map((r, i) => (
                    <td key={i} className="py-2.5 pl-4 pr-2 text-right font-semibold last:rounded-r-md">
                      {money(r.adjustedPrice)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <StepHeading
          title="Adjustment rates"
          detail="Placeholder values. Set these from paired sales or market data for the subject's market."
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {(Object.keys(RATE_LABELS) as (keyof AdjustmentRates)[]).map((k) => (
            <label key={k}>
              <span className="label">{RATE_LABELS[k]}</span>
              <input
                type="number"
                className="input"
                value={draft.rates[k]}
                onChange={(e) => setDraft((d) => ({ ...d, rates: { ...d.rates, [k]: Number(e.target.value) || 0 } }))}
              />
            </label>
          ))}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card py-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function warn(value: number | null, limit: number) {
  return value != null && Math.abs(value) > limit ? "font-semibold text-warn" : "";
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
    <details className="group mb-6 rounded-lg border border-dashed border-line bg-accent-soft/40 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-accent">
        ✦ Fill from a listing or public record
      </summary>
      <div className="mt-3 space-y-2">
        <textarea
          className="input min-h-28"
          placeholder="Paste an MLS listing sheet, county record, or your notes. AI fills only the fields it finds."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={run}>
            {busy ? "Reading…" : "Fill fields"}
          </button>
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>
      </div>
    </details>
  );
}
