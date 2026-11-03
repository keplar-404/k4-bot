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
