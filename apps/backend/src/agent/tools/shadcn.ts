import { tool } from "langchain";
import { z } from "zod";

/**
 * The "shadcn/ui" connected app. The official shadcn MCP server (`npx shadcn mcp`) only runs on a local machine,
 * so these tools give a bot the same registry the server reads: the public JSON at ui.shadcn.com/r (free, no key).
 * Names follow the MCP convention used for remote servers here: "<server>_<tool>".
 */
const REGISTRY = "https://ui.shadcn.com/r/styles/new-york-v4";
const INDEX_TTL_MS = 60 * 60_000;
const MAX_SOURCE_CHARS = 30_000;

type Item = {
  name: string;
  type: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: Array<{ path: string; content?: string }>;
};

// The index (~180 KB) is kept per Worker isolate for an hour: one fetch serves every run and bot on that isolate.
let index: { at: number; items: Item[] } | undefined;

async function items(): Promise<Item[]> {
  if (index && Date.now() - index.at < INDEX_TTL_MS) return index.items;
  const response = await fetch(`${REGISTRY}/registry.json`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`The shadcn registry answered ${response.status}.`);
  const body = (await response.json()) as { items: Item[] };
  // Fonts, styles and internal items are not things a bot adds to an app.
  const list = body.items.filter((i) => ["registry:ui", "registry:block", "registry:example", "registry:hook", "registry:lib", "registry:theme"].includes(i.type));
  index = { at: Date.now(), items: list };
  return list;
}

const KINDS: Record<string, string> = {
  component: "registry:ui",
  block: "registry:block",
  example: "registry:example",
};

const line = (i: Item) => `- ${i.name} (${i.type.replace("registry:", "")})${i.description ? `: ${i.description}` : ""}`;
const validName = z.string().regex(/^[a-z0-9-]{1,80}$/, "lowercase letters, digits and hyphens");

export function createShadcnTools() {
  const search = tool(
    async ({ query, kind, limit }) => {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const found = (await items())
        .filter((i) => !kind || i.type === KINDS[kind])
        .map((i) => {
          const hay = `${i.name} ${i.description ?? ""}`.toLowerCase();
          return { i, score: words.reduce((s, w) => s + (i.name === w ? 5 : i.name.includes(w) ? 3 : hay.includes(w) ? 1 : 0), 0) };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit ?? 20);
      return found.length ? found.map((r) => line(r.i)).join("\n") : `Nothing matches "${query}". Try a broader word (e.g. "button", "dashboard", "form").`;
    },
    {
      name: "shadcn_search_items",
      description: "Search the shadcn/ui registry for components, blocks (whole page sections like dashboards, login pages) and examples.",
      schema: z.object({
        query: z.string().min(1).max(100).describe('Words to look for, e.g. "date picker" or "sidebar".'),
        kind: z.enum(["component", "block", "example"]).optional().describe("Only this kind of item."),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    },
  );

  const view = tool(
    async ({ names }) => {
      const parts: string[] = [];
      let budget = MAX_SOURCE_CHARS;
      for (const name of names) {
        const response = await fetch(`${REGISTRY}/${name}.json`, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) {
          parts.push(`## ${name}\nNot found in the registry.`);
          continue;
        }
        const item = (await response.json()) as Item;
        const head = [
          `## ${item.name} (${item.type.replace("registry:", "")})`,
          item.description ?? "",
          item.dependencies?.length ? `npm dependencies: ${item.dependencies.join(", ")}` : "",
          item.registryDependencies?.length ? `uses registry items: ${item.registryDependencies.join(", ")}` : "",
        ].filter(Boolean);
        parts.push(head.join("\n"));
        for (const file of item.files ?? []) {
          const code = file.content ?? "";
          const shown = code.slice(0, Math.max(0, budget));
          budget -= shown.length;
          parts.push(`### ${file.path}\n\`\`\`tsx\n${shown}${shown.length < code.length ? "\n// …clipped" : ""}\n\`\`\``);
        }
      }
      return parts.join("\n\n");
    },
    {
      name: "shadcn_view_items",
      description: "Read shadcn/ui registry items: their source code, npm dependencies and the registry items they use.",
      schema: z.object({ names: z.array(validName).min(1).max(5).describe('Item names, e.g. ["button", "dialog"].') }),
    },
  );

  const examples = tool(
    async ({ name }) => {
      const found = (await items()).filter((i) => i.type === "registry:example" && (i.name === `${name}-demo` || i.name.startsWith(`${name}-`)));
      return found.length
        ? `Examples for ${name} (read one with shadcn_view_items):\n${found.slice(0, 25).map(line).join("\n")}`
        : `No examples named after "${name}". Search with shadcn_search_items instead.`;
    },
    {
      name: "shadcn_get_item_examples",
      description: "List usage examples for a shadcn/ui component (e.g. button-demo, button-loading).",
      schema: z.object({ name: validName.describe('Component name, e.g. "button".') }),
    },
  );

  const addCommand = tool(
    ({ names }) => `npx shadcn@latest add ${names.join(" ")}`,
    {
      name: "shadcn_get_add_command",
      description: "The command that adds shadcn/ui items to a project (run it in the project folder).",
      schema: z.object({ names: z.array(validName).min(1).max(20) }),
    },
  );

  return [search, view, examples, addCommand];
}
