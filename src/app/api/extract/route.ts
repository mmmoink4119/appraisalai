import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CompSchema, PropertySchema } from "@/lib/appraisal";
import { claudeErrorResponse, missingKeyResponse } from "@/lib/claude";

const SYSTEM = `You extract residential property data for an appraiser filling out a URAR / UAD 3.6 report.
Read the pasted listing sheet, public record, or notes and fill in the fields you can find.
Use null for anything the text does not state. Never guess or estimate a value.
Convert acres to square feet (1 acre = 43,560 sq ft). Dates are YYYY-MM-DD.
Only map condition/quality to a UAD 1-6 rating when the text states a C or Q rating explicitly.
Sale type is ArmsLength unless the text says otherwise (REO, short sale, estate, etc.).`;

export async function POST(request: Request) {
  const { text, kind } = (await request.json()) as { text?: string; kind?: "subject" | "comp" };
  if (!text?.trim()) {
    return Response.json({ error: "Paste some listing or public record text first." }, { status: 400 });
  }

  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  const schema = kind === "comp" ? CompSchema : PropertySchema;

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      // On a safety-classifier decline, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't extract fields from that text." }, { status: 422 });
    }
    return Response.json({ fields: response.parsed_output });
  } catch (err) {
    return claudeErrorResponse(err);
  }
}
