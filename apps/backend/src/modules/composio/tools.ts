import type { Composio } from "@composio/core";

/** One action of an app, as the action picker lists it. */
export type ToolSummary = {
  slug: string;
  name: string;
  description: string;
  version: string | null;
  toolkit: string | null;
};

/** One action with what it takes and gives (JSON Schema), for the settings form and the run. */
export type ToolDetail = ToolSummary & {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  tags: string[];
};

type RawTool = {
  slug: string;
  name: string;
  description?: string;
  version?: string;
  toolkit?: { slug?: string };
  tags?: string[];
  inputParameters?: Record<string, unknown>;
  outputParameters?: Record<string, unknown>;
};

const TTL_MS = 60 * 60_000;
const MAX_CACHED = 300;
const cache = new Map<string, { at: number; value: unknown }>();

/** A small per-isolate cache: app action lists change rarely, and GitHub's alone is ~5 MB from Composio. */
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}

const summary = (t: RawTool): ToolSummary => ({
  slug: t.slug,
  name: t.name,
  description: (t.description ?? "").slice(0, 300),
  version: t.version ?? null,
  toolkit: t.toolkit?.slug?.toLowerCase() ?? null,
});

/** Every action of one app, light (no schemas): what the picker needs. */
export function listTools(composio: Composio, toolkit: string): Promise<ToolSummary[]> {
  return cached(`list:${toolkit}`, async () => {
    const res = (await composio.tools.getRawComposioTools({
      toolkits: [toolkit],
      limit: 1000,
    })) as unknown as RawTool[] | { items: RawTool[] };
    const items = Array.isArray(res) ? res : res.items;
    return items.map(summary).sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** One action with its input and output schemas. */
export function getTool(composio: Composio, slug: string): Promise<ToolDetail> {
  return cached(`tool:${slug}`, async () => {
    const t = (await composio.tools.getRawComposioToolBySlug(slug)) as unknown as RawTool;
    return {
      ...summary(t),
      input: t.inputParameters ?? {},
      output: t.outputParameters ?? {},
      tags: t.tags ?? [],
    };
  });
}
