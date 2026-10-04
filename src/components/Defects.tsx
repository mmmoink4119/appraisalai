"use client";

import { DEFECT_ACTIONS, DEFECT_FEATURES, type Defect, emptyDefect } from "@/lib/report";

// UAD 3.6 apparent defects, damages and deficiencies: one row per item.
export default function Defects({ defects, onChange }: { defects: Defect[]; onChange: (defects: Defect[]) => void }) {
  const set = (i: number, patch: Partial<Defect>) => onChange(defects.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Apparent defects, damages and deficiencies</h2>
          <p className="mt-0.5 text-sm text-muted">
            UAD 3.6 lists each item with its location, the recommended action and the cost to cure. Leave this empty if
            there are none.
          </p>
        </div>
        <button className="btn" onClick={() => onChange([...defects, emptyDefect()])}>
          + Add item
        </button>
      </div>
      {defects.length === 0 ? (
        <p className="text-sm text-muted">No defects, damages or deficiencies noted.</p>
      ) : (
        <div className="space-y-4">
          {defects.map((d, i) => (
            <div key={i} className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line p-3 sm:grid-cols-3 lg:grid-cols-6">
              <label>
                <span className="label">Feature</span>
                <select
                  className="input"
                  value={d.feature ?? ""}
                  onChange={(e) => set(i, { feature: (e.target.value || null) as Defect["feature"] })}
                >
                  <option value="">—</option>
                  {DEFECT_FEATURES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Location</span>
                <input className="input" value={d.location} onChange={(e) => set(i, { location: e.target.value })} />
              </label>
              <label>
                <span className="label">Affects soundness</span>
                <select
                  className="input"
                  value={d.affectsSoundness == null ? "" : String(d.affectsSoundness)}
                  onChange={(e) => set(i, { affectsSoundness: e.target.value === "" ? null : e.target.value === "true" })}
                >
                  <option value="">—</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label>
                <span className="label">Recommended action</span>
                <select
                  className="input"
                  value={d.action ?? ""}
                  onChange={(e) => set(i, { action: (e.target.value || null) as Defect["action"] })}
                >
                  <option value="">—</option>
                  {DEFECT_ACTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Cost to cure</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  value={d.cost ?? ""}
                  onChange={(e) => set(i, { cost: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </label>
              <div className="flex items-end">
                <button className="text-sm text-danger hover:underline" onClick={() => onChange(defects.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
              <label className="col-span-full">
                <span className="label">Description</span>
                <input className="input" value={d.description} onChange={(e) => set(i, { description: e.target.value })} />
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
