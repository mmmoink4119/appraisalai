import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claudeErrorResponse, missingKeyResponse } from "@/lib/claude";
import { CATALOGS, catalogText, extractionSchema, normalize } from "@/lib/extraction";

// Documents an appraiser receives or writes for an assignment: the order or
// engagement letter, the agreement of sale, tax records, inspection notes.
export type UploadedDocument = {
  name: string;
  // "text" documents carry plain text; the others carry base64 data.
  kind: "pdf" | "image" | "text";
  mediaType: string;
  data: string;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

const SYSTEM = `You help a licensed residential appraiser fill out a URAR (Form 1004) appraisal report from the documents for an assignment: an order or engagement letter, an agreement of sale, tax or deed records, a flood certification, or the appraiser's own inspection notes.
Return every report field the documents state, using the field keys listed below.
Rules:
- Only report what a document actually states. Leave a field out rather than guess, estimate or infer a value.
- For a select field, use one of the listed options exactly, or leave it out.
- Dates are YYYY-MM-DD. Money and numbers are plain digits without $ or commas.
- Yes/No fields are "Yes" or "No".
- Text fields keep the document's wording, shortened only where it is long.
- The source is a short quote from the document that states the value.

Fields:
`;

export async function POST(request: Request) {
  const { documents } = (await request.json()) as { documents?: UploadedDocument[] };
  if (!documents?.length) return Response.json({ error: "Add a document or some text first." }, { status: 400 });

  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const doc of documents) {
    content.push({ type: "text", text: `Document: ${doc.name}` });
    if (doc.kind === "pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.data } });
    } else if (doc.kind === "image") {
      const mediaType = IMAGE_TYPES.find((t) => t === doc.mediaType);
      if (!mediaType) return Response.json({ error: `${doc.name}: use a JPEG, PNG, GIF or WebP image.` }, { status: 400 });
      content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: doc.data } });
    } else {
      content.push({ type: "text", text: doc.data });
    }
  }
  content.push({ type: "text", text: "Extract the report fields these documents state." });

  const entries = CATALOGS.report();

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(extractionSchema(entries)) },
      // On a safety-classifier decline, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM + catalogText(entries),
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't read report fields from these documents." }, { status: 422 });
    }
    return Response.json({ fields: normalize(response.parsed_output.fields, entries) });
  } catch (err) {
    return claudeErrorResponse(err);
  }
}
