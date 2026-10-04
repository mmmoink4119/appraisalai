import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CompSchema, PropertySchema } from "@/lib/appraisal";

const SYSTEM = `You extract residential property data for an appraiser filling out a URAR (Form 1004) report.
Read the pasted listing sheet, public record, or notes and fill in the fields you can find.
Use null for anything the text does not state. Never guess or estimate a value.
Convert acres to square feet (1 acre = 43,560 sq ft). Dates are YYYY-MM-DD.
Only map condition/quality to a UAD 1-6 rating when the text states a C or Q rating explicitly.`;

export async function POST(request: Request) {
  const { text, kind } = (await request.json()) as { text?: string; kind?: "subject" | "comp" };
  if (!text?.trim()) {
    return Response.json({ error: "Paste some listing or public record text first." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "Set ANTHROPIC_API_KEY in .env.local to use AI extraction." }, { status: 500 });
  }

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
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The ANTHROPIC_API_KEY in .env.local was rejected." }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Rate limited, try again in a moment." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: err.message }, { status: 502 });
    }
    if (err instanceof Anthropic.AnthropicError) {
      // Thrown by the client itself, e.g. when no API key is configured.
      return Response.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }
}
