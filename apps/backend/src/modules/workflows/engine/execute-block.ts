import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import type { WorkflowNode } from "../graph/schema";
import { type ActionNode, limitOutput, runAction } from "./blocks/action";
import { runAi } from "./blocks/ai";
import { evaluate } from "./conditions";
import { FatalBlockError, userMessage } from "./errors";
import { listToLoop } from "./loop";
import { resolve, resolveAsData, resolveDeep, type RunContext } from "./template";

type AiNode = Extract<WorkflowNode, { kind: "ai.bot" }>;

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
  if (node.kind === "ai.bot") return runAiStep(env, db, node, ctx, run);
  try {
    return { ok: true, input: node.config, ...runLogic(node, ctx) };
  } catch (error) {
    // Logic blocks are pure: the same input fails the same way again.
    return { ok: false, input: node.config, error: userMessage(error), retryable: false };
  }
}

function runLogic(node: Exclude<WorkflowNode, ActionNode | AiNode>, ctx: RunContext) {
  switch (node.kind) {
    case "trigger.manual":
    case "trigger.schedule":
    case "trigger.webhook":
    case "trigger.app":
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
    case "logic.loop":
      // Not cut by limitOutput: the walk reads the items back from this output (resolve caps them at 100 KB).
      return { output: listToLoop(resolve(node.config.items, ctx), node.config.max) };
    case "logic.delay":
    case "logic.approval":
      // Both wait durably in run-node.ts and never reach here.
      return { output: null };
  }
}

/** The AI step. Its prompt never holds secrets (publishing refuses them outside app and HTTP blocks). */
async function runAiStep(
  env: Env,
  db: Db,
  node: AiNode,
  ctx: RunContext,
  run: { id: string; userId: string },
): Promise<BlockResult> {
  let input: unknown = node.config;
  try {
    const prompt = resolveAsData(node.config.prompt, ctx);
    input = { ...node.config, prompt };
    const output = await runAi(env, db, { ...run, nodeId: node.id }, node.config, prompt);
    return { ok: true, input, output: limitOutput(output) };
  } catch (error) {
    return { ok: false, input, error: userMessage(error), retryable: !(error instanceof FatalBlockError) };
  }
}
