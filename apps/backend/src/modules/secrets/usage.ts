import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { workflow } from "../../db/schema";

/** One place a secret is used: the workflow, and what it is for there (an app, a site, or a webhook check). */
export type SecretUse = { workflowId: string; workflowName: string; target: string; kind: "app" | "http" | "webhook" };

const REF = /\{\{\s*secrets\.([A-Z][A-Z0-9_]{1,40})\s*\}\}/g;

type Node = { kind?: string; config?: Record<string, unknown> };

/** The site an HTTP block calls ("api.stripe.com"), or a short form of its URL when it is a template. */
function hostOf(url: unknown): string {
  if (typeof url !== "string" || !url.trim()) return "HTTP request";
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, "").split(/[/?#]/)[0]?.slice(0, 60) || "HTTP request";
  }
}

/** What a block uses its secrets for, as the Secrets page shows it. */
function targetOf(node: Node): Pick<SecretUse, "target" | "kind"> {
  if (node.kind === "action.app") return { kind: "app", target: String(node.config?.toolkit ?? "App") };
  if (node.kind === "trigger.webhook") return { kind: "webhook", target: "Webhook check" };
  return { kind: "http", target: hostOf(node.config?.url) };
}

/**
 * For every secret name, where the user's workflows use it (draft and published copies, each place once).
 * Read from the graphs: `{{secrets.NAME}}` in a block's settings, or the secret a webhook trigger checks.
 */
export async function secretUsage(db: Db, userId: string): Promise<Map<string, SecretUse[]>> {
  const rows = await db
    .select({ id: workflow.id, name: workflow.name, graph: workflow.graph, published: workflow.publishedGraph })
    .from(workflow)
    .where(eq(workflow.userId, userId));
  const out = new Map<string, SecretUse[]>();
  const add = (secret: string, use: SecretUse) => {
    const list = out.get(secret) ?? [];
    if (!list.some((u) => u.workflowId === use.workflowId && u.target === use.target)) list.push(use);
    out.set(secret, list);
  };
  for (const w of rows) {
    const nodes = [...((w.graph?.nodes ?? []) as Node[]), ...((w.published?.nodes ?? []) as Node[])];
    for (const node of nodes) {
      const names = new Set<string>();
      for (const m of JSON.stringify(node.config ?? {}).matchAll(REF)) names.add(m[1]!);
      const webhookSecret = node.kind === "trigger.webhook" ? node.config?.secretName : undefined;
      if (typeof webhookSecret === "string" && webhookSecret) names.add(webhookSecret);
      for (const secret of names) add(secret, { workflowId: w.id, workflowName: w.name, ...targetOf(node) });
    }
  }
  return out;
}
