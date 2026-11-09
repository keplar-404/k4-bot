/**
 * Reads every Composio app's actions and events (the same data the builder shows) and reports input fields whose
 * default or example does not fit the field's type, or that have no description. One-off; it makes one API call per
 * app and per app's events, so run it on purpose:
 *
 *   bun run composio:audit                 # every app in the catalog
 *   bun run composio:audit gmail slack     # only these
 *
 * Needs COMPOSIO_API_KEY (and DATABASE_URL for the catalog). Writes scripts/composio/audit-report.json.
 */
import { writeFile } from "node:fs/promises";
import { Composio } from "@composio/core";
import { neon } from "@neondatabase/serverless";
import { type FieldSchema, inputProblems } from "../../src/modules/composio/schema-quality";

const apiKey = process.env.COMPOSIO_API_KEY;
if (!apiKey) throw new Error("Set COMPOSIO_API_KEY.");
const composio = new Composio({ apiKey });

const only = process.argv.slice(2);
const slugs = only.length
  ? only
  : (await neon(process.env.DATABASE_URL!)`select slug from composio_toolkit order by rank`).map((r) => String(r.slug));

type Row = { toolkit: string; kind: "action" | "event"; slug: string; field: string; problem: string };
const rows: Row[] = [];
const failed: string[] = [];
const pause = () => new Promise((r) => setTimeout(r, 250)); // Composio rate-limits API keys: stay well under.

for (const [i, toolkit] of slugs.entries()) {
  try {
    const tools = (await composio.tools.getRawComposioTools({ toolkits: [toolkit], limit: 1000, important: false })) as unknown as
      | Array<{ slug: string; inputParameters?: { properties?: Record<string, FieldSchema> } }>
      | { items: Array<{ slug: string; inputParameters?: { properties?: Record<string, FieldSchema> } }> };
    for (const t of Array.isArray(tools) ? tools : tools.items) {
      for (const p of inputProblems(t.inputParameters?.properties)) rows.push({ toolkit, kind: "action", slug: t.slug, ...p });
    }
    const events = (await composio.triggers.listTypes({ toolkits: [toolkit] })) as unknown as {
      items?: Array<{ slug: string; config?: { properties?: Record<string, FieldSchema> } }>;
    };
    for (const e of events.items ?? []) {
      for (const p of inputProblems(e.config?.properties)) rows.push({ toolkit, kind: "event", slug: e.slug, ...p });
    }
  } catch (error) {
    failed.push(`${toolkit}: ${(error as Error).message}`);
  }
  if (i % 25 === 0) console.log(`${i + 1}/${slugs.length} apps…`);
  await pause();
}

const byProblem = Object.groupBy(rows, (r) => r.problem);
const summary = Object.fromEntries(Object.entries(byProblem).map(([k, v]) => [k, v?.length ?? 0]));
await writeFile("scripts/composio/audit-report.json", JSON.stringify({ apps: slugs.length, summary, failed, rows }, null, 2));
console.log({ apps: slugs.length, summary, failed: failed.length });
