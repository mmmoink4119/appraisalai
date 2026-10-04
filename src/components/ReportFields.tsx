"use client";

import type { ReportData, ReportField, ReportGroup, ReportValue } from "@/lib/report";

// Form for report sections defined in lib/report.ts.
export default function ReportFields({
  groups,
  data,
  onChange,
}: {
  groups: ReportGroup[];
  data: ReportData;
  onChange: (key: string, value: ReportValue) => void;
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <fieldset key={group.title}>
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{group.title}</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.fields.map((field) => (
              <label key={field.key} className={field.type === "longtext" ? "col-span-full" : wide(field) ? "col-span-2" : ""}>
                <span className="label">{field.label}</span>
                <Input field={field} value={data[field.key] ?? null} onChange={(v) => onChange(field.key, v)} />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

// Long labels and free text get two columns so they don't wrap awkwardly.
const wide = (field: ReportField) => field.label.length > 34 || (field.type === "select" && field.options!.some((o) => o.length > 18));

function Input({ field, value, onChange }: { field: ReportField; value: ReportValue; onChange: (v: ReportValue) => void }) {
  if (field.type === "bool" || field.type === "select") {
    const options = field.type === "bool" ? [["true", "Yes"], ["false", "No"]] : field.options!.map((o) => [o, o]);
    return (
      <select
        className="input"
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? null : field.type === "bool" ? raw === "true" : raw);
        }}
      >
        <option value="">—</option>
        {options.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
    );
  }
  if (field.type === "longtext") {
    return (
      <textarea
        className="input min-h-20"
        value={(value as string | null) ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      />
    );
  }
  const numeric = field.type === "number" || field.type === "money";
  return (
    <input
      type={numeric ? "number" : field.type === "date" ? "date" : "text"}
      inputMode={numeric ? "decimal" : undefined}
      className="input"
      value={value == null ? "" : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : numeric ? Number(raw) : raw);
      }}
    />
  );
}
