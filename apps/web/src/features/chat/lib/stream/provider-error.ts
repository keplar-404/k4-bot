/**
 * Provider errors are written for developers. Users get one plain sentence;
 * the raw text stays in the bubble tooltip for whoever is debugging.
 *
 * Classified by the provider's HTTP status, never by searching the text for
 * digits: "404" appears inside request ids and URLs, which used to turn
 * unrelated failures into "model no longer available".
 */
export function friendlyProviderError(raw: string, status?: number): string {
  // OpenAI-SDK style messages begin with the status ("429 Provider returned…").
  const code = status ?? (Number(/^\s*(\d{3})\b/.exec(raw)?.[1]) || undefined);
  const s = raw.toLowerCase();

  switch (code) {
    case 401:
      return "The model provider rejected the API key. Check OPENROUTER_API_KEY.";
    case 402:
      return "The model provider account is out of credit. Add credit or pick a free model.";
    case 403:
      return "That model isn't available to this app. Pick another one.";
    case 404:
      return "That model is no longer available. Pick another one.";
    case 408:
    case 504:
      return "The model took too long to respond. Try again.";
    case 429:
      // Neither carries a reset time, so never promise one.
      if (s.includes("free-models-per-day") || s.includes("daily limit")) {
        return "You've used today's free requests for this model. It resets at midnight UTC — or pick a paid model.";
      }
      if (s.includes("rate-limited upstream") || s.includes("shared_pool")) {
        return "This free model's shared pool is busy right now. Try again in a few seconds, or pick another model.";
      }
      return "That model is busy right now. Try again in a moment, or pick another model.";
  }
  if (code !== undefined && code >= 500) {
    return "The model provider had a problem. Try again, or pick another model.";
  }
  if (s.includes("context") && (s.includes("length") || s.includes("window"))) {
    return "This conversation is too long for that model. Start a new chat.";
  }
  if (s.includes("timeout") || s.includes("timed out")) {
    return "The model took too long to respond. Try again.";
  }
  return "The model didn't respond. Try again.";
}

/**
 * The server's verdict on a failed run (`reason`, from the backend's provider-error.ts), as one plain sentence.
 * Limits follow OpenRouter's docs: free models allow 20 requests a minute and 50 a day (1000 a day once 10
 * credits were bought). https://openrouter.ai/docs/api-reference/limits
 */
const REASON_COPY: Record<string, string> = {
  free_daily_limit:
    "Daily request limit reached for free models (OpenRouter allows 50 a day, or 1000 after buying 10 credits). It resets at 00:00 UTC — or pick a paid model.",
  rate_limited:
    "Too many requests per minute for this model (free models allow 20 a minute). The bot tried again but kept hitting the limit. Wait a minute and retry.",
  upstream_busy:
    "The free model's provider is out of shared capacity right now. The bot tried again but it stayed busy. Retry in a few minutes or pick another model.",
  no_credits:
    "The OpenRouter account is out of credit (or its key hit its spending cap). Add credit, raise the key's limit, or pick a free model.",
  key_limit:
    "The OpenRouter API key reached its own spending limit. Raise the key's limit in OpenRouter (Settings → Keys) or use another key.",
  invalid_key: "OpenRouter rejected the API key. Check OPENROUTER_API_KEY.",
  forbidden:
    "OpenRouter refused this request (no access to the model, or blocked by moderation). Pick another model or rephrase.",
  model_not_found:
    "That model is no longer available on OpenRouter. Pick another one.",
  model_unavailable:
    "The model is down right now. The bot tried again but it did not come back. Retry later or pick another model.",
  no_provider:
    "No provider can serve this model right now. Retry later or pick another model.",
  timeout:
    "The model took too long to respond, even after retrying. Try again.",
  context_too_long:
    "This conversation is too long for the model. Run /compact or start a new chat.",
  provider_error:
    "The model provider kept failing, even after retrying. Try again later or pick another model.",
  network:
    "The connection to the model kept dropping, even after retrying. Try again.",
};

export const reasonMessage = (reason: unknown): string | undefined =>
  typeof reason === "string" ? REASON_COPY[reason] : undefined;
