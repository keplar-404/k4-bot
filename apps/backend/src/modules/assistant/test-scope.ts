import { ancestors } from "../workflows/graph/loop-rules";
import type { WorkflowGraph, WorkflowNode } from "../workflows/graph/schema";

/** The blocks a test really runs: all of them, or (Test this step) the chosen block and those before it. Pinned blocks use their sample, so they run nothing. */
export function blocksRun(g: WorkflowGraph, until?: string): WorkflowNode[] {
  const scope = until ? new Set([until, ...ancestors(g, until)]) : null;
  return g.nodes.filter((n) => (!scope || scope.has(n.id)) && !(g.pins && n.id in g.pins));
}

/** An HTTP request that is not a plain read changes something on the other side. */
export const httpChangesData = (method: string) => !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());

/**
 * What a test would really change in the user's apps, in words, so the user can be asked first: app actions that
 * are not reads (`isRead` says per action slug) and HTTP requests that are not GET. Empty means the test only reads.
 */
export function dataChanges(blocks: WorkflowNode[], isReadAction: (toolkit: string, tool: string) => boolean): string[] {
  const out: string[] = [];
  for (const n of blocks) {
    const name = n.label ?? n.id;
    if (n.kind === "action.app" && n.config.tool && n.config.toolkit && !isReadAction(n.config.toolkit, n.config.tool)) {
      out.push(`${name} (${n.config.tool})`);
    } else if (n.kind === "action.http" && httpChangesData(n.config.method)) {
      out.push(`${name} (${n.config.method} ${n.config.url.slice(0, 60)})`);
    }
  }
  return out;
}
