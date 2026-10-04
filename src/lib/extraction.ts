import { z } from "zod";
import { CompSchema, PropertySchema } from "./appraisal";
import { REPORT_FIELDS, coerce, type ReportField, type ReportValue } from "./report";

// Structured outputs allow only a handful of nullable fields per request, so
// extraction asks for a list of {key, value} pairs instead of one object with
// a nullable field per report field. Values come back as strings and are
// converted to each field's type here.

function propertyEntries(schema: z.ZodObject, prefix: string): ReportField[] {
  return Object.entries(schema.shape).map(([key, def]) => {
    const inner = def instanceof z.ZodNullable ? def.unwrap() : def;
    const hint = def.description ?? inner.description;
    const type: ReportField["type"] =
      inner instanceof z.ZodNumber ? "number"
      : inner instanceof z.ZodBoolean ? "bool"
      : inner instanceof z.ZodEnum ? "select"
      : hint?.includes("YYYY-MM-DD") ? "date"
      : "text";
    const options = inner instanceof z.ZodEnum ? (inner.options as string[]) : undefined;
    return { key: `${prefix}${key}`, label: key, type, options, hint };
  });
}

export const CATALOGS = {
  // Paste-to-fill on a single property.
  subject: () => propertyEntries(PropertySchema, ""),
  comp: () => propertyEntries(CompSchema, ""),
  // Whole-report extraction from documents: subject characteristics plus
  // every report section.
  report: () => [...propertyEntries(PropertySchema, "subject."), ...REPORT_FIELDS],
};

export function extractionSchema(entries: ReportField[]) {
  const keys = entries.map((e) => e.key) as [string, ...string[]];
  return z.object({
    fields: z.array(
      z.object({
        key: z.enum(keys),
        value: z.string().describe("The value as written in the document, converted to the field's format"),
        source: z.string().describe("A short quote from the document that states this value"),
      }),
    ),
  });
}

// One line per field for the system prompt.
export function catalogText(entries: ReportField[]): string {
  return entries
    .map((e) => {
      const type = e.type === "select" ? `one of: ${e.options?.join(" | ")}` : e.type === "bool" ? "Yes or No" : e.type;
      return `- ${e.key} (${e.label}; ${type})${e.hint ? `: ${e.hint}` : ""}`;
    })
    .join("\n");
}

const RATING = /(^|\.)(condition|quality)$/;

export type ExtractedField = { key: string; label: string; value: ReportValue; source: string };

// Typed values for the fields that fit, first mention wins.
export function normalize(raw: { key: string; value: string; source: string }[], entries: ReportField[]): ExtractedField[] {
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const seen = new Set<string>();
  const out: ExtractedField[] = [];
  for (const item of raw) {
    const entry = byKey.get(item.key);
    if (!entry || seen.has(item.key)) continue;
    let value = RATING.test(item.key) ? coerce(entry, item.value.replace(/^[CQ]/i, "")) : coerce(entry, item.value);
    if (RATING.test(item.key) && (typeof value !== "number" || value < 1 || value > 6)) value = null;
    if (value == null) continue;
    seen.add(item.key);
    out.push({ key: item.key, label: entry.label, value, source: item.source });
  }
  return out;
}
