import type { WorkflowStep } from "cloudflare:workers";
import type { WorkflowNode } from "../graph/schema";
import { runApproval } from "./approval";
import { runDelay } from "./delay";
import { type NodeDeps, type NodeResult, once } from "./durable";
import { userMessage } from "./errors";
import { executeBlock } from "./execute-block";
import type { RunContext } from "./template";

/**
 * What a block's step returns. Workflows saves it and hands it back on resume; the output travels as a JSON
 * string because a step result must be serializable and the output's type is unknown here.
 */
type StepResult =
  | { status: "cancelled" }
  | { status: "failed"; error: string }
  | { status: "succeeded"; outputJson: string; ifResult: boolean | null; passed: boolean | null };

/**
 * Runs one block as durable Workflow steps. Everything that writes happens INSIDE a step: code outside a step runs
 * again each time the Workflow resumes. A block never throws out of here; it ends succeeded, failed or cancelled.
 * `key` names the steps: the block id, plus `#<n>` inside a For each, so every pass is its own durable step.
 */
export function runNode(step: WorkflowStep, deps: NodeDeps, node: WorkflowNode, ctx: RunContext, key = node.id) {
  if (node.kind === "logic.delay") return runDelay(step, deps, node, key);
  if (node.kind === "logic.approval") return runApproval(step, deps, node, ctx, key);
  return runWithRetries(step, deps, node, ctx, key);
}

async function runWithRetries(
  step: WorkflowStep,
  deps: NodeDeps,
  node: WorkflowNode,
  ctx: RunContext,
  key: string,
): Promise<NodeResult> {
  const retry = "retry" in node ? node.retry : undefined;
  const maxAttempts = retry?.maxAttempts ?? 1;
  const config = {
    retries: {
      limit: maxAttempts - 1,
      delay: `${retry?.delaySeconds ?? 10} seconds` as const,
      backoff: retry?.backoff ?? "exponential",
    },
    // A bot that searches and reads apps needs longer than one API call.
    timeout: node.kind === "ai.bot" ? ("5 minutes" as const) : ("2 minutes" as const),
  };

  try {
    const result = await step.do(`block:${key}`, config, ({ attempt }) =>
      tryBlock(deps, node, ctx, attempt, maxAttempts),
    );
    if (result.status !== "succeeded") return result;
    return {
      status: "succeeded",
      output: JSON.parse(result.outputJson),
      ifResult: result.ifResult ?? undefined,
      passed: result.passed ?? undefined,
    };
  } catch (error) {
    // The step timed out, or Workflows stopped retrying: the block failed, not the whole engine.
    const message = userMessage(error);
    await once(step, `fail:${key}`, () => deps.log.step(node, { status: "failed", error: message }));
    return { status: "failed", error: message };
  }
}

/** One try. A failure that a retry may fix is thrown, so Workflows waits and calls this step again. */
async function tryBlock(
  { env, db, log, run }: NodeDeps,
  node: WorkflowNode,
  ctx: RunContext,
  attempt: number,
  maxAttempts: number,
): Promise<StepResult> {
  if (await log.isCancelled()) return { status: "cancelled" };
  await log.step(node, { status: attempt > 1 ? "retrying" : "running", attempt, input: node.config });

  const result = await executeBlock(env, db, node, ctx, run);
  if (result.ok) {
    await log.step(node, {
      status: "succeeded",
      attempt,
      input: result.input,
      output: result.output,
      error: null,
    });
    return {
      status: "succeeded",
      outputJson: JSON.stringify(result.output ?? null),
      ifResult: result.ifResult ?? null,
      passed: result.passed ?? null,
    };
  }

  const lastTry = !result.retryable || attempt >= maxAttempts;
  const status = lastTry ? "failed" : "retrying";
  await log.step(node, { status, attempt, input: result.input, error: result.error });
  if (lastTry) return { status: "failed", error: result.error };
  throw new Error(result.error);
}
