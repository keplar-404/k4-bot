import type { WorkflowGraph, WorkflowNode } from "./schema";

/**
 * A workflow as a file another user can import ("k4-workflow" JSON). Shared by the web app (export, preview) and the
 * import route, so this file has type imports only: nothing else is bundled into the browser.
 *
 * What belongs to the person who built it never leaves: connected accounts, their bots and files, pinned sample data,
 * and every secret reference ({{secrets.X}} and the webhook's secret name). The import route strips again, so a
 * hand-edited file cannot bring any of it in.
 */

export const PORTABLE_FORMAT = "k4-workflow";
export const PORTABLE_VERSION = 1;
/** Largest file accepted, in characters of JSON. */
export const MAX_PORTABLE_CHARS = 512 * 1024;

export type PortableWorkflow = {
  format: typeof PORTABLE_FORMAT;
  version: typeof PORTABLE_VERSION;
  name: string;
  description: string;
  exportedAt: string;
  /** What the importer must set up: apps to connect, Ask a bot blocks that need one of their bots. */
  requires: { apps: string[]; bots: number };
  graph: WorkflowGraph;
};

const SECRET_REF = /\{\{\s*secrets\.[^}]*\}\}/g;

/** Every string inside a value with secret references removed (a copy; the input is not changed). */
function withoutSecrets<T>(value: T): T {
  if (typeof value === "string") return value.replace(SECRET_REF, "") as T;
  if (Array.isArray(value)) return value.map(withoutSecrets) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutSecrets(v)])) as T;
  }
  return value;
}

function stripNode(node: WorkflowNode): WorkflowNode {
  const n = withoutSecrets(node);
  switch (n.kind) {
    case "action.app":
    case "trigger.app": {
      const { connectedAccountId: _a, ...config } = n.config;
      return { ...n, config } as WorkflowNode;
    }
    case "ai.bot": {
      const { botId: _b, ...config } = n.config;
      return { ...n, config: { ...config, files: [] } };
    }
    case "trigger.webhook": {
      const { secretName: _s, ...config } = n.config;
      return { ...n, config };
    }
    default:
      return n;
  }
}

/** The graph without anything private to its owner (see the file comment). */
export function stripPrivate(graph: WorkflowGraph): WorkflowGraph {
  return { nodes: graph.nodes.map(stripNode), edges: graph.edges };
}

export function requirementsOf(graph: WorkflowGraph): PortableWorkflow["requires"] {
  const apps = new Set<string>();
  let bots = 0;
  for (const n of graph.nodes) {
    if ((n.kind === "action.app" || n.kind === "trigger.app") && n.config.toolkit) apps.add(n.config.toolkit);
    if (n.kind === "ai.bot" && n.config.agent === "bot") bots++;
  }
  return { apps: [...apps].sort(), bots };
}

export function toPortable(w: { name: string; description: string | null; graph: WorkflowGraph }): PortableWorkflow {
  const graph = stripPrivate(w.graph);
  return {
    format: PORTABLE_FORMAT,
    version: PORTABLE_VERSION,
    name: w.name,
    description: w.description ?? "",
    exportedAt: new Date().toISOString(),
    requires: requirementsOf(graph),
    graph,
  };
}

/** Looks like a key or token typed straight into a field (not through a secret). Shown as a warning before sharing. */
const LEAK_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/,
  /\b(sk|pk|rk)[-_](live|test|proj)?[-_]?[A-Za-z0-9]{16,}/,
  /\b(ghp|gho|ghs|github_pat|xox[abprs]|AKIA|AIza)[A-Za-z0-9_-]{12,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
];

/** Labels of blocks whose settings look like they hold a key or token. */
export function findLeakedKeys(graph: WorkflowGraph): string[] {
  return graph.nodes
    .filter((n) => {
      const text = JSON.stringify(n.config);
      return LEAK_PATTERNS.some((p) => p.test(text));
    })
    .map((n) => n.label ?? n.id);
}

/** What an import will bring in, for the review before replacing the canvas. */
export function reviewOf(graph: WorkflowGraph) {
  const hosts = new Set<string>();
  let code = 0;
  for (const n of graph.nodes) {
    if (n.kind === "action.code") code++;
    if (n.kind === "action.http") {
      const url = n.config.url.trim();
      try {
        hosts.add(new URL(url).host || url);
      } catch {
        if (url) hosts.add(url.slice(0, 80));
      }
    }
  }
  return { blocks: graph.nodes.length, ...requirementsOf(graph), hosts: [...hosts], code };
}
