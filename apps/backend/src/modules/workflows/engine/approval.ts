import type { WorkflowStep } from "cloudflare:workers";
import type { WorkflowNode } from "../graph/schema";
import { type NodeDeps, type NodeResult, once } from "./durable";
import { resolve, type RunContext } from "./template";

type ApprovalNode = Extract<WorkflowNode, { kind: "logic.approval" }>;
/** What POST /runs/:runId/steps/:nodeId/answer sends to the waiting run. */
export type ApprovalAnswer = { approved: boolean; note: string; at: string };

/** The Workflows event a waiting approval block listens for (ids are [A-Za-z0-9_-], valid in an event type). */
export const approvalEventType = (nodeId: string) => `approval-${nodeId}`;

/**
 * Ask me first: shows its message in the builder and suspends the run (durably, at no cost) until the user answers.
 * Approved goes on; declined stops the path after it, like a Filter; no answer in time fails the block.
 */
export async function runApproval(
  step: WorkflowStep,
  { log }: NodeDeps,
  node: ApprovalNode,
  ctx: RunContext,
  key: string,
): Promise<NodeResult> {
  const asked = await step.do(`ask:${key}`, async () => {
    if (await log.isCancelled()) return null;
    const message = String(resolve(node.config.message, ctx) ?? "") || "Continue this run?";
    await log.step(node, { status: "waiting", input: { message }, output: { message, waitingForAnswer: true } });
    return message;
  });
  if (asked === null) return { status: "cancelled" };

  let answer: ApprovalAnswer;
  try {
    const event = await step.waitForEvent<ApprovalAnswer>(`answer:${key}`, {
      type: approvalEventType(node.id),
      timeout: `${node.config.timeoutHours} hours`,
    });
    answer = event.payload;
  } catch {
    const error = `No answer within ${node.config.timeoutHours} hours.`;
    await once(step, `unanswered:${key}`, () => log.step(node, { status: "failed", error }));
    return { status: "failed", error };
  }

  const output = { message: asked, approved: answer.approved, note: answer.note, answeredAt: answer.at };
  await once(step, `answered:${key}`, () => log.step(node, { status: "succeeded", output, error: null }));
  return { status: "succeeded", output, passed: answer.approved };
}
