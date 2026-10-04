"use client";

import type { AdjustmentRates, Comp, Property } from "@/lib/appraisal";
import { SALE_TYPES } from "@/lib/appraisal";

export type FieldDef = {
  key: keyof Comp;
  label: string;
  type: "text" | "longtext" | "number" | "bool" | "select" | "rating";
  options?: readonly string[];
  prefix?: "C" | "Q";
};

export type FieldGroup = { title: string; fields: FieldDef[] };

export const PROPERTY_GROUPS: FieldGroup[] = [
  {
    title: "Location",
    fields: [
      { key: "address", label: "Address", type: "text" },
      { key: "city", label: "City", type: "text" },
      { key: "state", label: "State", type: "text" },
      { key: "zip", label: "Zip", type: "text" },
      { key: "county", label: "County", type: "text" },
      { key: "parcelNumber", label: "Parcel #", type: "text" },
    ],
  },
  {
    title: "Site and building",
    fields: [
      { key: "design", label: "Design (style)", type: "text" },
      { key: "yearBuilt", label: "Year built", type: "number" },
      { key: "gla", label: "GLA (sq ft)", type: "number" },
      { key: "lotSizeSqFt", label: "Site (sq ft)", type: "number" },
      { key: "basementSqFt", label: "Basement (sq ft)", type: "number" },
      { key: "basementFinishedSqFt", label: "Finished bsmt (sq ft)", type: "number" },
      { key: "garageSpaces", label: "Garage spaces", type: "number" },
    ],
  },
  {
    title: "Rooms",
    fields: [
      { key: "bedrooms", label: "Bedrooms", type: "number" },
      { key: "fullBaths", label: "Full baths", type: "number" },
      { key: "halfBaths", label: "Half baths", type: "number" },
    ],
  },
  {
    title: "Ratings and features",
    fields: [
      { key: "condition", label: "Condition", type: "rating", prefix: "C" },
      { key: "quality", label: "Quality", type: "rating", prefix: "Q" },
      { key: "fireplaces", label: "Fireplaces", type: "number" },
      { key: "pool", label: "Pool", type: "bool" },
      { key: "heatingCooling", label: "Heating/cooling", type: "text" },
      { key: "view", label: "View", type: "text" },
    ],
  },
];

export const SALE_GROUP: FieldGroup = {
  title: "Sale",
  fields: [
    { key: "salePrice", label: "Sale price", type: "number" },
    { key: "saleDate", label: "Sale date", type: "text" },
    { key: "listPrice", label: "List price", type: "number" },
    { key: "daysOnMarket", label: "Days on market", type: "number" },
    { key: "saleType", label: "Sale type", type: "select", options: SALE_TYPES },
    { key: "financing", label: "Financing", type: "text" },
    { key: "concessions", label: "Concessions ($)", type: "number" },
    { key: "status", label: "MLS status", type: "text" },
    { key: "dataSource", label: "Data source", type: "text" },
  ],
};

export const REMARKS_GROUP: FieldGroup = {
  title: "Listing remarks",
  fields: [{ key: "remarks", label: "Public remarks", type: "longtext" }],
};

export const RATE_LABELS: Record<keyof AdjustmentRates, string> = {
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

export const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

// How many of the given fields have a value, for progress hints.
export function filledCount(value: Property, groups: FieldGroup[]) {
  const record = value as Record<string, unknown>;
  const keys = groups.flatMap((g) => g.fields.map((f) => f.key));
  return { filled: keys.filter((k) => record[k] != null && record[k] !== "").length, total: keys.length };
}

export function FieldGroups<T extends Property>({
  groups,
  value,
  onChange,
}: {
  groups: FieldGroup[];
  value: T;
  onChange: (v: T) => void;
}) {
  const record = value as Record<string, unknown>;
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <fieldset key={group.title}>
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{group.title}</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.fields.map((f) => (
              <label
                key={f.key}
                className={f.type === "longtext" ? "col-span-full" : f.key === "address" ? "col-span-2" : ""}
              >
                <span className="label">{f.label}</span>
                <FieldInput field={f} value={record[f.key]} onChange={(v) => set(f.key, v)} />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (field.type === "bool") {
    return (
      <select
        className="input"
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")}
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (field.type === "longtext") {
    return (
      <textarea
        className="input min-h-24"
        value={(value as string | null) ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      />
    );
  }
  if (field.type === "rating") {
    return (
      <select
        className="input"
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">—</option>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <option key={n} value={n}>
            {field.prefix}
            {n}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "select") {
    return (
      <select
        className="input"
        value={(value as string | null) ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">—</option>
        {field.options?.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type}
      className="input"
      value={(value as string | number | null) ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : field.type === "number" ? Number(raw) : raw);
      }}
    />
  );
}
