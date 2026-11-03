import { resolveModel } from "./models";

/** OpenRouter's public model list: each model's real context window. No key needed. */
const CATALOG = "https://openrouter.ai/api/v1/models";
const TTL_MS = 60 * 60_000;

let cache: { at: number; lengths: Map<string, number> } | undefined;

/** Context windows by model id, read live once an hour per isolate (and cached at the edge). Empty when unreachable. */
async function liveLengths(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.lengths;
  try {
    const res = await fetch(CATALOG, { signal: AbortSignal.timeout(8_000), cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit);
    const body = (await res.json()) as { data?: Array<{ id?: string; context_length?: number }> };
    const lengths = new Map<string, number>();
    for (const m of body.data ?? []) if (m.id && m.context_length) lengths.set(m.id, m.context_length);
    cache = { at: Date.now(), lengths };
    return lengths;
  } catch {
    return cache?.lengths ?? new Map();
  }
}

/** The model's context window in tokens: live from OpenRouter, else the catalog's own value. */
export async function contextLengthOf(modelId: string): Promise<number> {
  return (await liveLengths()).get(modelId) ?? resolveModel(modelId)?.contextLength ?? 128_000;
}
