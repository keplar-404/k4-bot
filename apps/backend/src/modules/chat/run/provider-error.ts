/**
 * What went wrong with the model call, in terms the chat can explain. OpenRouter reports the HTTP status on the
 * error for request errors, but a provider failure (or one inside a stream, after the 200 was sent) often arrives
 * as text only: "Provider returned error | metadata: {...provider_error_code: "429"...}". So the status is also
 * read from that text. https://openrouter.ai/docs/api-reference/errors
 */
export type FailureReason =
  /** OpenRouter's daily cap on free-model requests (50 a day, 1000 with 10+ credits bought). */
  | "free_daily_limit"
  /** Too many requests a minute (free models: 20). Passes in a moment. */
  | "rate_limited"
  /** The provider behind a free model is out of shared capacity. Passes in a moment. */
  | "upstream_busy"
  | "no_credits"
  /** The OpenRouter API key reached the spending limit set on the key itself. */
  | "key_limit"
  | "invalid_key"
  | "forbidden"
  /** The model id no longer exists on OpenRouter. */
  | "model_not_found"
  /** The model is down or answered with something invalid (502). Passes in a moment. */
  | "model_unavailable"
  | "no_provider"
  | "timeout"
  | "context_too_long"
  | "provider_error"
  /** A network failure with no status (connection dropped, stream cut). */
  | "network"
  | "unknown";

export function classifyProviderError(error: unknown): { reason: FailureReason; status?: number } {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  const status = statusOf(error, text);
  const lower = text.toLowerCase();

  if (lower.includes("context") && /length|window|too long|maximum/.test(lower)) return { reason: "context_too_long", status };
  // OpenRouter's per-key spending cap ("Key limit exceeded (total limit)"), whatever status it comes with.
  if (lower.includes("key limit exceeded")) return { reason: "key_limit", status };
  switch (status) {
    case 429:
      if (lower.includes("free-models-per-day") || /per[- ]day|daily/.test(lower)) return { reason: "free_daily_limit", status };
      if (lower.includes("rate-limited upstream") || lower.includes("upstream_provider")) return { reason: "upstream_busy", status };
      return { reason: "rate_limited", status };
    case 425:
      return { reason: "rate_limited", status };
    case 402:
      return { reason: "no_credits", status };
    case 401:
      return { reason: "invalid_key", status };
    case 403:
      return { reason: "forbidden", status };
    case 404:
      return { reason: "model_not_found", status };
    case 502:
      return { reason: "model_unavailable", status };
    case 503:
      return { reason: "no_provider", status };
    case 408:
    case 504:
      return { reason: "timeout", status };
  }
  if (status !== undefined && status >= 500) return { reason: "provider_error", status };
  if (/timed? ?out|ETIMEDOUT/i.test(text)) return { reason: "timeout", status };
  if (/fetch failed|network|socket|ECONNRESET|terminated|premature|stream.*(closed|ended|interrupted)/i.test(text)) return { reason: "network", status };
  if (/provider returned error|overloaded|unavailable/i.test(text)) return { reason: "provider_error", status };
  return { reason: "unknown", status };
}

/** Failures that usually pass if the run waits and tries again. A daily cap, missing credit or a bad key do not. */
const TRANSIENT = new Set<FailureReason>(["rate_limited", "upstream_busy", "model_unavailable", "no_provider", "timeout", "provider_error", "network"]);

export const isTransient = (error: unknown) => TRANSIENT.has(classifyProviderError(error).reason);

function statusOf(error: unknown, text: string): number | undefined {
  const own = (error as { status?: unknown })?.status;
  if (typeof own === "number") return own;
  const embedded = /provider_error_code\\?"?\s*:\s*\\?"?(\d{3})/.exec(text) ?? /"code"\s*:\s*(\d{3})/.exec(text) ?? /^\S*\s*(\d{3})\b/.exec(text);
  return embedded ? Number(embedded[1]) : undefined;
}
