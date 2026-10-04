import Anthropic from "@anthropic-ai/sdk";

// Shared by the API routes that call Claude.

export function missingKeyResponse(): Response | null {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return null;
  return Response.json({ error: "Set ANTHROPIC_API_KEY in .env.local to use AI features." }, { status: 500 });
}

export function claudeErrorResponse(err: unknown): Response {
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
    return Response.json({ error: err.message }, { status: 500 });
  }
  throw err;
}
