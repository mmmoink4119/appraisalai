import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claudeErrorResponse, missingKeyResponse } from "@/lib/claude";
import { ColumnMappingSchema, IMPORT_FIELDS } from "@/lib/csvImport";

const SYSTEM = `You map the columns of an MLS CSV export onto the fields of a residential appraisal comparable sale (URAR / UAD 3.6).
Return one mapping per field, using the exact header text, or null when no column holds that field.
Pick a transform for each mapped column:
- text: copy as is. number: numeric value (prices, sq ft, counts, year). date: a date.
- acresToSqFt: lot size given in acres. Prefer a sq ft lot column when both exist.
- bathsDecimalFull / bathsDecimalHalf: a single "total baths" column written like 2.1 (2 full, 1 half). Prefer separate full and half bath columns when they exist.
- yesNo: yes/no style columns such as pool. saleType: MLS sale or listing type wording (REO, short sale, etc.).
Field notes: gla is above-grade finished living area. salePrice is the closed/sold price, not the list price. saleDate is the closing date.
dataSource should map to the MLS listing number column. Leave condition and quality null unless a column holds UAD C1-C6 / Q1-Q6 ratings.`;

export async function POST(request: Request) {
  const { headers, sampleRows } = (await request.json()) as { headers?: string[]; sampleRows?: string[][] };
  if (!headers?.length) {
    return Response.json({ error: "The CSV has no header row." }, { status: 400 });
  }
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  const sample = [headers, ...(sampleRows ?? []).slice(0, 5)]
    .map((r) => r.map((c) => JSON.stringify(c)).join(","))
    .join("\n");

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: betaZodOutputFormat(ColumnMappingSchema) },
      // On a safety-classifier decline, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Fields: ${IMPORT_FIELDS.join(", ")}\n\nCSV header and sample rows:\n${sample}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't work out the CSV columns." }, { status: 422 });
    }
    // Drop any column name that isn't actually in the file.
    const mappings = response.parsed_output.mappings.map((m) =>
      m.column && headers.includes(m.column) ? m : { ...m, column: null },
    );
    return Response.json({ mappings });
  } catch (err) {
    return claudeErrorResponse(err);
  }
}
