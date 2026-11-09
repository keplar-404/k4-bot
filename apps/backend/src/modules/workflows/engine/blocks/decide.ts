import { BadRequestError, AuthenticationError, PermissionDeniedError, UnprocessableEntityError } from "@typesafe-ai/sdk";
import { and, count, eq, gte, like } from "drizzle-orm";
import type { Env } from "../../../../config/env";
import type { Db } from "../../../../db";
import { agentUsage } from "../../../../db/schema";
import { decide } from "../../../decisions/client";
import type { WorkflowNode } from "../../graph/schema";
import { FatalBlockError, userMessage } from "../errors";
import type { BlockResult } from "../execute-block";
import { resolveAsData, type RunContext } from "../template";

type DecideNode = Extract<WorkflowNode, { kind: "ai.decide" }>;

/** Decisions one user may run a day: each is a paid API call, and a busy trigger could start thousands. */
export const MAX_DECISIONS_PER_DAY = 1000;

async function decisionsToday(db: Db, userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(agentUsage)
    .where(and(eq(agentUsage.userId, userId), like(agentUsage.runId, "dec:%"), gte(agentUsage.createdAt, new Date(Date.now() - 86_400_000))));
  return row?.n ?? 0;
}

/**
 * The Decide (Jev) block. Values filled into the state are wrapped as data (an email cannot change the questions).
 * Bad requests and a bad key fail at once; rate limits and server errors retry with the block's settings.
 */
export async function runDecide(env: Env, db: Db, node: DecideNode, ctx: RunContext, run: { id: string; userId: string }): Promise<BlockResult> {
  let input: unknown = node.config;
  try {
    if (!env.TYPESAFE_API_KEY) throw new FatalBlockError("Decision blocks are not set up on this server (TYPESAFE_API_KEY).");
    if ((await decisionsToday(db, run.userId)) >= MAX_DECISIONS_PER_DAY) {
      throw new FatalBlockError(`You've used ${MAX_DECISIONS_PER_DAY} decisions in 24 hours.`);
    }
    const state = resolveAsData(node.config.state, ctx);
    input = { ...node.config, state };
    const result = await decide(env.TYPESAFE_API_KEY, node.config.model, state, node.config.questions);
    await db.insert(agentUsage).values({
      userId: run.userId,
      runId: `dec:${run.id}:${node.id}`,
      model: `typesafe/${result.model}`,
      inputTokens: result.usage.input,
      outputTokens: result.usage.output,
    });
    return { ok: true, input, output: { model: result.model, answers: result.answers } };
  } catch (error) {
    const fatal =
      error instanceof FatalBlockError ||
      error instanceof BadRequestError ||
      error instanceof UnprocessableEntityError ||
      error instanceof AuthenticationError ||
      error instanceof PermissionDeniedError;
    return { ok: false, input, error: userMessage(error), retryable: !fatal };
  }
}
