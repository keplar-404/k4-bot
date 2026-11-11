import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import type { WorkflowNode } from "../graph/schema";
import { type ActionNode, limitOutput, runAction } from "./blocks/action";
import { runAi } from "./blocks/ai";
import { runCode } from "./blocks/code";
import { runDecide } from "./blocks/decide";
import { OTHERWISE } from "../graph/switch-block";
import { evaluate } from "./conditions";
import { runFormat } from "./format";
import { FatalBlockError, userMessage } from "./errors";
import { listToLoop } from "./loop";
import { runList, runMerge } from "./list-ops";
import { runSet } from "./set-fields";
import { resolve, resolveAsData, resolveDeep, type RunContext } from "./template";

type AiNode = Extract<WorkflowNode, { kind: "ai.bot" | "ai.decide" | "action.code" }>;

/** What one try of a block produced. `input` is what it was given, with every secret value replaced. */
export type BlockResult =
  | { ok: true; input: unknown; output: unknown; ifResult?: boolean; passed?: boolean; route?: string }
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
  if (node.kind === "ai.decide") return runDecide(env, db, node, ctx, run);
  if (node.kind === "action.code") return runCodeStep(env, db, node, ctx, run);
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
    case "logic.format":
      return { output: limitOutput(runFormat(node.config, ctx)) };
    case "logic.merge":
      return { output: limitOutput(runMerge(node.config, node.config.inputs.filter((i) => i.trim()).map((i) => resolve(i, ctx)))) };
    case "logic.list":
      return { output: limitOutput(runList(node.config, resolve(node.config.input, ctx))) };
    case "logic.switch": {
      // The first rule that holds picks the output; none → "otherwise" when it exists, else no output at all.
      const rule = node.config.rules.find((r) => evaluate(r, ctx));
      const route = rule?.id ?? (node.config.otherwise ? OTHERWISE : "none");
      return { output: { route, label: rule?.label || route }, route };
    }
    case "logic.filter": {
      const passed = evaluate(node.config, ctx);
      return { output: { passed }, passed };
    }
    case "logic.set":
    case "logic.return":
      return { output: limitOutput(runSet(node.config, ctx)) };
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
  node: Extract<AiNode, { kind: "ai.bot" }>,
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

/** The Code block: its inputs filled in (references, never secrets), then the code run in a sandbox. */
async function runCodeStep(
  env: Env,
  db: Db,
  node: Extract<WorkflowNode, { kind: "action.code" }>,
  ctx: RunContext,
  run: { id: string; userId: string },
): Promise<BlockResult> {
  const input = Object.fromEntries(node.config.inputs.map((i) => [i.key, resolveDeep(i.value, ctx)]));
  try {
    return { ok: true, input: { input }, output: limitOutput(await runCode(env, db, run, node.config, input)) };
  } catch (error) {
    return { ok: false, input: { input }, error: userMessage(error), retryable: !(error instanceof FatalBlockError) };
  }
}
