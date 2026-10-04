import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claudeErrorResponse, missingKeyResponse } from "@/lib/claude";
import { CATALOGS, catalogText, extractionSchema, normalize } from "@/lib/extraction";

const SYSTEM = `You extract residential property data for an appraiser filling out a URAR / UAD 3.6 report.
Read the pasted listing sheet, public record, or notes and return the fields you can find, using the field keys listed below.
Leave out anything the text does not state. Never guess or estimate a value.
Convert acres to square feet (1 acre = 43,560 sq ft). Dates are YYYY-MM-DD. Numbers are plain digits.
Only give a condition or quality rating when the text states a C or Q rating explicitly.
Sale type is ArmsLength unless the text says otherwise (REO, short sale, estate, etc.).

Fields:
`;

export async function POST(request: Request) {
  const { text, kind } = (await request.json()) as { text?: string; kind?: "subject" | "comp" };
  if (!text?.trim()) {
    return Response.json({ error: "Paste some listing or public record text first." }, { status: 400 });
  }

  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  const entries = kind === "comp" ? CATALOGS.comp() : CATALOGS.subject();

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: betaZodOutputFormat(extractionSchema(entries)) },
      // On a safety-classifier decline, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM + catalogText(entries),
      messages: [{ role: "user", content: text }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't extract fields from that text." }, { status: 422 });
    }
    const found = normalize(response.parsed_output.fields, entries);
    return Response.json({ fields: Object.fromEntries(found.map((f) => [f.key, f.value])) });
  } catch (err) {
    return claudeErrorResponse(err);
  }
}
