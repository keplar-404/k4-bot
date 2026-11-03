/**
 * A small client for Tavily's REST API (https://docs.tavily.com/documentation/api-reference). Called directly
 * rather than through @langchain/tavily: that wrapper lags the API (no `fast` depth, start/end dates, or
 * chunks_per_source on extract), and these four endpoints are plain JSON over fetch, which suits a Worker.
 *
 * Results are formatted as compact text for the model, not raw JSON: the model reads titles, URLs, dates and
 * passages, and nothing else costs tokens.
 */
const API = "https://api.tavily.com";

export class TavilyError extends Error {}

export async function call<T>(apiKey: string, path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await response.json().catch(() => null)) as (T & { detail?: { error?: string } | string }) | null;
  if (!response.ok || !data) {
    const detail = typeof data?.detail === "string" ? data.detail : data?.detail?.error;
    // 432/433 are Tavily's plan and usage limits: the model should stop and tell the user, not retry.
    const hint = response.status === 432 || response.status === 433 ? " The web search allowance is used up; tell the user." : "";
    throw new TavilyError(`Tavily ${path.slice(1)} failed (${response.status}): ${detail ?? "no details"}.${hint}`.slice(0, 300));
  }
  return data;
}

/** Strip undefined fields: Tavily rejects some explicit nulls. */
export const compact = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));

export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}\n…[clipped, ${text.length - max} more characters]` : text);
