import { and, eq, gte, like, sql } from "drizzle-orm";
import type { Db } from "../../../../db";
import { agentUsage } from "../../../../db/schema";

/** AI steps one user may run a day: each is a paid model call, and a busy trigger could start thousands. */
export const MAX_AI_STEPS_PER_DAY = 100;
export const MAX_OUTPUT_TOKENS = 8192;
/** Tools a bot may use inside a workflow: reading only. Nobody is there to approve an action or answer a question. */
export const READ_ONLY_APP_TOOLS = new Set(["app_find_actions", "app_action_details", "app_read"]);

export async function aiStepsToday(db: Db, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${agentUsage.runId})::int` })
    .from(agentUsage)
    .where(
      and(
        eq(agentUsage.userId, userId),
        like(agentUsage.runId, "wf:%"),
        gte(agentUsage.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    );
  return row?.n ?? 0;
}

/** Reads the model's answer as one JSON object, also when it wrapped it in a code fence. */
export function parseJsonAnswer(text: string): Record<string, unknown> | null {
  const body = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const value = JSON.parse(body);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
