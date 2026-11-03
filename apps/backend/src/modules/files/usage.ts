import { and, eq, gte, like, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { agentUsage } from "../../db/schema";

/**
 * Every created image is also an `agent_usage` row (model "image:<id>"). Those rows stay when the file is
 * deleted, so deleting images never hands back today's allowance.
 */
export const IMAGE_USAGE_PREFIX = "image:";

/** Images created today (UTC) by any of the user's bots. */
export async function imagesToday(db: Db, userId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(agentUsage)
    .where(and(eq(agentUsage.userId, userId), like(agentUsage.model, `${IMAGE_USAGE_PREFIX}%`), gte(agentUsage.createdAt, start)));
  return Number(row?.n ?? 0);
}
