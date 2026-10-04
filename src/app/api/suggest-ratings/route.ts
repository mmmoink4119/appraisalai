import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { type Comp, RatingSuggestionListSchema } from "@/lib/appraisal";
import { claudeErrorResponse, missingKeyResponse } from "@/lib/claude";

const SYSTEM = `You help a residential appraiser assign UAD condition (C1-C6) and quality (Q1-Q6) ratings to comparable sales, using MLS listing remarks and property facts.

UAD condition ratings:
C1: Newly constructed, never occupied; no physical depreciation.
C2: No deferred maintenance, little or no physical depreciation; virtually all building components are new or have been recently repaired, refinished or rehabilitated.
C3: Well maintained with limited physical depreciation from normal wear and tear; some components, but not every major component, may be updated or recently rehabilitated.
C4: Some minor deferred maintenance and physical deterioration from normal wear and tear; adequately maintained, needing only minimal repairs; major components are functional.
C5: Obvious deferred maintenance; in need of some significant repairs or rehabilitation; livability somewhat diminished but still usable.
C6: Substantial damage or deferred maintenance severe enough to affect safety, soundness or structural integrity.

UAD quality ratings:
Q1: Unique, individually designed, exceptionally high-quality workmanship and materials throughout.
Q2: Custom designed for an individual owner, high-quality materials and workmanship.
Q3: Higher quality, from individual or readily available designer plans, above-standard materials and finishes.
Q4: Standard or modified standard plans, meets or exceeds code, average quality materials and finishes.
Q5: Economy of construction and basic functionality; plain design, basic floor plans, basic finishes.
Q6: Basic quality, simple or no plans, may not meet code.

Rules:
- Remarks are marketing copy written by the listing agent, so read them skeptically: "move-in ready" alone is weak evidence, specific recent updates (new kitchen, new roof, new HVAC with years) are stronger, and "as-is", "needs TLC" or "investor special" point toward C4 or C5.
- Typical tract or rowhome construction with no notable materials is Q4; only go to Q3 or above with specific evidence.
- If the remarks are missing or say nothing useful, return null for that rating with low confidence. Never invent facts.
- The reason cites the specific words in the remarks that drove each rating.
- Return one suggestion per input property, using its index.`;

export async function POST(request: Request) {
  const { comps } = (await request.json()) as { comps?: { index: number; comp: Comp }[] };
  if (!comps?.length) {
    return Response.json({ error: "Add comps with listing remarks first." }, { status: 400 });
  }
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  const input = comps.map(({ index, comp }) => ({
    index,
    address: comp.address,
    yearBuilt: comp.yearBuilt,
    design: comp.design,
    gla: comp.gla,
    salePrice: comp.salePrice,
    saleType: comp.saleType,
    remarks: comp.remarks,
  }));

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(RatingSuggestionListSchema) },
      // On a safety-classifier decline, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(input, null, 2) }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't suggest ratings for these comps." }, { status: 422 });
    }
    // Keep only ratings inside the UAD 1-6 range.
    const valid = (n: number | null) => (n != null && Number.isInteger(n) && n >= 1 && n <= 6 ? n : null);
    const suggestions = response.parsed_output.suggestions.map((s) => ({
      ...s,
      condition: valid(s.condition),
      quality: valid(s.quality),
    }));
    return Response.json({ suggestions });
  } catch (err) {
    return claudeErrorResponse(err);
  }
}
