import { z } from "zod";

/**
 * The "shadcn/ui" connected app. The official shadcn MCP server (`npx shadcn mcp`) only runs on a local machine,
 * so these tools give a bot the same registry the server reads: the public JSON at ui.shadcn.com/r (free, no key).
 * Names follow the MCP convention used for remote servers here: "<server>_<tool>".
 */
export const REGISTRY = "https://ui.shadcn.com/r/styles/new-york-v4";
const INDEX_TTL_MS = 60 * 60_000;
export const MAX_SOURCE_CHARS = 30_000;

export type Item = {
  name: string;
  type: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: Array<{ path: string; content?: string }>;
};

// The index (~180 KB) is kept per Worker isolate for an hour: one fetch serves every run and bot on that isolate.
let index: { at: number; items: Item[] } | undefined;

export async function items(): Promise<Item[]> {
  if (index && Date.now() - index.at < INDEX_TTL_MS) return index.items;
  const response = await fetch(`${REGISTRY}/registry.json`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`The shadcn registry answered ${response.status}.`);
  const body = (await response.json()) as { items: Item[] };
  // Fonts, styles and internal items are not things a bot adds to an app.
  const list = body.items.filter((i) => ["registry:ui", "registry:block", "registry:example", "registry:hook", "registry:lib", "registry:theme"].includes(i.type));
  index = { at: Date.now(), items: list };
  return list;
}

export const KINDS: Record<string, string> = {
  component: "registry:ui",
  block: "registry:block",
  example: "registry:example",
};

export const line = (i: Item) => `- ${i.name} (${i.type.replace("registry:", "")})${i.description ? `: ${i.description}` : ""}`;
export const validName = z.string().regex(/^[a-z0-9-]{1,80}$/, "lowercase letters, digits and hyphens");
