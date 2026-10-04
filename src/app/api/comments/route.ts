import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { type AdjustmentRates, type Comp, type Property, CommentsSchema, adjustComp } from "@/lib/appraisal";
import { claudeErrorResponse, missingKeyResponse } from "@/lib/claude";
import { FIELD_BY_KEY, formatValue, type ReportData } from "@/lib/report";

const SYSTEM = `You draft the narrative comments of a residential appraisal report (URAR / UAD 3.6) for a licensed appraiser to review and edit.
Write in the plain, factual third-person style appraisers use. Keep each section to a short paragraph.
Use only the facts provided: the report fields filled so far (assignment, contract, neighborhood, site, improvements, reconciliation), the subject and comparable data, the computed adjustments, and the appraiser's notes.
Where a statement needs a fact you were not given (neighborhood boundaries, market trend, the final value opinion, an inspection observation), write a bracketed placeholder such as [describe boundaries] instead of inventing it.
Never state a final opinion of value unless the appraiser's notes give one.
The sales comparison summary should explain which comps were given the most weight and why, citing the gross and net adjustment percentages and any comp outside the usual 15% net / 25% gross guidelines.`;

type CommentsRequest = { subject: Property; comps: Comp[]; rates: AdjustmentRates; report?: ReportData; notes?: string };

export async function POST(request: Request) {
  const { subject, comps, rates, report = {}, notes } = (await request.json()) as CommentsRequest;
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  // Numbered as on the worksheet grid, skipping comps without a sale price.
  const compSummaries = comps.flatMap((c, i) => {
    if (c.salePrice == null) return [];
    const r = adjustComp(subject, c, rates);
    const adjustments = Object.fromEntries(r.lines.filter((l) => l.amount !== 0).map((l) => [l.label, l.amount]));
    return [{
      comp: i + 1,
      ...Object.fromEntries(Object.entries(c).filter(([, v]) => v != null)),
      adjustments,
      netAdjustment: r.net,
      netPct: r.netPct == null ? null : Math.round(r.netPct * 1000) / 10,
      grossPct: r.grossPct == null ? null : Math.round(r.grossPct * 1000) / 10,
      adjustedPrice: r.adjustedPrice,
    }];
  });

  // Labelled report fields, e.g. "Property values": "Stable".
  const reportFields = Object.fromEntries(
    Object.entries(report).flatMap(([key, value]) => {
      const field = FIELD_BY_KEY.get(key);
      if (!field || key.startsWith("appraiser.") || value == null || value === "") return [];
      return [[`${key.split(".")[0]}: ${field.label}`, formatValue(field, value)]];
    }),
  );

  const input = {
    reportFields,
    subject: Object.fromEntries(Object.entries(subject).filter(([, v]) => v != null)),
    comparables: compSummaries,
    appraiserNotes: notes?.trim() || null,
  };

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(CommentsSchema) },
      // On a safety-classifier decline, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(input, null, 2) }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't draft comments from this report." }, { status: 422 });
    }
    return Response.json({ comments: response.parsed_output });
  } catch (err) {
    return claudeErrorResponse(err);
  }
}
