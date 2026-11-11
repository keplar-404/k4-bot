import { pathsOf } from "./fields";

type Step = { nodeId: string; nodeKind: string; status: string; error?: string | null; input?: unknown; output?: unknown };
export type RunLike = { id: string; status: string; error?: string | null; failedNodeId?: string | null; steps: Step[] };

const clip = (v: unknown, max: number) => {
  if (v === undefined || v === null) return undefined;
  const text = JSON.stringify(v);
  return text.length <= max ? v : `${text.slice(0, max)}… (cut)`;
};

const REFERENCE = /\{\{\s*steps\.([A-Za-z0-9_-]+)\.output\.?([A-Za-z0-9_.-]*)\s*\}\}/g;

/** The value at a path such as "messages.0.subject" inside a step's output, or undefined when it is not there. */
function valueAt(output: unknown, path: string): unknown {
  let cur: unknown = output;
  for (const part of path.split(".").filter(Boolean)) {
    if (Array.isArray(cur) && /^\d+$/.test(part)) cur = cur[Number(part)];
    else if (cur !== null && typeof cur === "object" && Object.hasOwn(cur, part)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

export type ReferenceProblem = { ref: string; problem: string; realFields: string[] };

/**
 * The {{steps.<id>.output.<path>}} references in a block's settings that do not exist in what that step really
 * returned, with the fields that DO exist. This is the most common reason a block fails or gets empty values: a path
 * that was guessed. Steps whose output is not known are skipped (nothing to compare with).
 */
export function referenceProblems(config: unknown, outputs: Record<string, unknown>): ReferenceProblem[] {
  const text = JSON.stringify(config ?? null);
  const found = new Map<string, ReferenceProblem>();
  for (const m of text.matchAll(REFERENCE)) {
    const [ref, stepId = "", path = ""] = m;
    if (found.has(ref) || !(stepId in outputs)) continue;
    const out = outputs[stepId];
    if (path === "" || valueAt(out, path) !== undefined) continue;
    found.set(ref, {
      ref,
      problem: `Block "${stepId}" did not return "${path}".`,
      realFields: pathsOf(out, 25),
    });
  }
  return [...found.values()];
}

export type RunReport = {
  runId: string;
  status: string;
  failedAt?: {
    block: string;
    name: string;
    kind: string;
    why: string;
    /** What the failed block was given (its settings with the {{references}} filled in, or as written if it failed first). */
    input: unknown;
    /** {{references}} in its settings that point at fields the earlier block never returned (the usual cause). */
    wrongReferences?: ReferenceProblem[];
  };
  error?: string;
  /** Every step in run order, with what it was given and what it returned. */
  steps: Array<{ block: string; kind: string; status: string; error?: string; input?: unknown; output?: unknown }>;
};

/**
 * A run as the assistant reads it, with everything needed to fix it: how it ended; if it failed, WHICH block and WHY
 * (its error, what it was given, and any wrong {{reference}}); and every step's input and output, so each block's
 * result can be compared with what the next one expected. Long data is cut per step, so one run cannot flood the
 * model's context.
 */
export function runReport(
  run: RunLike,
  options: { nameOf?: (nodeId: string) => string; configOf?: (nodeId: string) => unknown } = {},
): RunReport {
  const nameOf = options.nameOf ?? ((id: string) => id);
  const failed = run.steps.find((s) => s.nodeId === run.failedNodeId) ?? run.steps.find((s) => s.status === "failed");
  const outputs = Object.fromEntries(run.steps.filter((s) => s.status === "succeeded" && s.output !== undefined).map((s) => [s.nodeId, s.output]));
  const wrong = failed ? referenceProblems(options.configOf?.(failed.nodeId) ?? failed.input, outputs) : [];
  return {
    runId: run.id,
    status: run.status,
    ...(failed
      ? {
          failedAt: {
            block: failed.nodeId,
            name: nameOf(failed.nodeId),
            kind: failed.nodeKind,
            why: failed.error ?? run.error ?? "It failed without a message.",
            input: clip(failed.input, 2500),
            ...(wrong.length ? { wrongReferences: wrong } : {}),
          },
        }
      : run.error
        ? { error: run.error }
        : {}),
    steps: run.steps.map((s) => ({
      block: s.nodeId,
      kind: s.nodeKind,
      status: s.status,
      ...(s.error ? { error: s.error } : {}),
      ...(s.input !== undefined ? { input: clip(s.input, 700) } : {}),
      ...(s.status === "succeeded" ? { output: clip(s.output, 1400) } : {}),
    })),
  };
}
