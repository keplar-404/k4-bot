import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import type { WorkflowNode } from "../graph/schema";
import { type ActionNode, limitOutput, runAction } from "./blocks/action";
import { evaluate } from "./conditions";
import { userMessage } from "./errors";
import { resolveDeep, type RunContext } from "./template";

/** What one try of a block produced. `input` is what it was given, with every secret value replaced. */
export type BlockResult =
  | { ok: true; input: unknown; output: unknown; ifResult?: boolean; passed?: boolean }
  | { ok: false; input: unknown; error: string; retryable: boolean };

/** Runs one try of a block. It never throws: a failure comes back as `ok: false`, with whether a retry can help. */
export async function executeBlock(
  env: Env,
  db: Db,
  node: WorkflowNode,
  ctx: RunContext,
  run: { id: string; userId: string },
): Promise<BlockResult> {
  if (node.kind === "action.app" || node.kind === "action.http") {
    return runAction(env, db, node, ctx, run);
  }
  try {
    return { ok: true, input: node.config, ...runLogic(node, ctx) };
  } catch (error) {
    // Logic blocks are pure: the same input fails the same way again.
    return { ok: false, input: node.config, error: userMessage(error), retryable: false };
  }
}

function runLogic(node: Exclude<WorkflowNode, ActionNode>, ctx: RunContext) {
  switch (node.kind) {
    case "trigger.manual":
    case "trigger.schedule":
    case "trigger.webhook":
      return { output: limitOutput(ctx.trigger) };
    case "logic.if": {
      const result = evaluate(node.config, ctx);
      return { output: { result }, ifResult: result };
    }
    case "logic.filter": {
      const passed = evaluate(node.config, ctx);
      return { output: { passed }, passed };
    }
    case "logic.set": {
      const fields = node.config.fields.map((f) => [f.key, resolveDeep(f.value, ctx)]);
      return { output: limitOutput(Object.fromEntries(fields)) };
    }
    case "logic.delay":
      // The wait itself is a durable sleep in run-node.ts; by the time this runs it is over.
      return { output: { waited: true } };
  }
}
