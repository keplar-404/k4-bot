import { and, count, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "../../../db";
import { bot, botWorkflow, workflow } from "../../../db/schema";

export const MAX_BOT_CREATIONS_PER_DAY = 10;
const MAX_BOTS_PER_WORKFLOW = 20;
const MAX_LISTED = 50;

/** The user's admin bot manages every workflow of that user (never another user's). */
async function isAdminBot(db: Db, userId: string, botId: string) {
  const [row] = await db.select({ kind: bot.kind }).from(bot).where(and(eq(bot.id, botId), eq(bot.userId, userId))).limit(1);
  return row?.kind === "admin";
}

async function anyWorkflowOfUser(db: Db, userId: string, workflowId: string) {
  const [row] = await db.select().from(workflow).where(and(eq(workflow.id, workflowId), eq(workflow.userId, userId))).limit(1);
  return row ?? null;
}

/** The user's workflows this bot may see and run: shared with it, or made by it (the admin bot: all of them). */
export async function workflowsOfBot(db: Db, userId: string, botId: string) {
  if (await isAdminBot(db, userId, botId)) return db.select().from(workflow).where(eq(workflow.userId, userId)).limit(MAX_LISTED);
  const rows = await db
    .select({ workflow })
    .from(botWorkflow)
    .innerJoin(workflow, eq(workflow.id, botWorkflow.workflowId))
    .where(and(eq(botWorkflow.botId, botId), eq(workflow.userId, userId)))
    .limit(MAX_LISTED);
  return rows.map((row) => row.workflow);
}

/** One workflow, only if it is the user's and this bot may use it. */
export async function workflowOfBot(db: Db, userId: string, botId: string, workflowId: string) {
  if (await isAdminBot(db, userId, botId)) return anyWorkflowOfUser(db, userId, workflowId);
  const [row] = await db
    .select({ workflow })
    .from(botWorkflow)
    .innerJoin(workflow, eq(workflow.id, botWorkflow.workflowId))
    .where(and(eq(botWorkflow.botId, botId), eq(botWorkflow.workflowId, workflowId), eq(workflow.userId, userId)))
    .limit(1);
  return row?.workflow ?? null;
}

/**
 * One workflow, only if this bot made it. Shared workflows can be read and run, never changed, turned on or off, or
 * deleted by a bot: those are the user's (or the creating bot's) to manage.
 */
export async function ownWorkflowOfBot(db: Db, userId: string, botId: string, workflowId: string) {
  if (await isAdminBot(db, userId, botId)) return anyWorkflowOfUser(db, userId, workflowId);
  const [row] = await db
    .select({ workflow })
    .from(botWorkflow)
    .innerJoin(workflow, eq(workflow.id, botWorkflow.workflowId))
    .where(
      and(
        eq(botWorkflow.botId, botId),
        eq(botWorkflow.workflowId, workflowId),
        eq(botWorkflow.createdByBot, true),
        eq(workflow.userId, userId),
      ),
    )
    .limit(1);
  return row?.workflow ?? null;
}

export async function grantBot(db: Db, botId: string, workflowId: string, createdByBot: boolean) {
  await db.insert(botWorkflow).values({ botId, workflowId, createdByBot }).onConflictDoNothing();
}

/** How many workflows this bot made in the last 24 hours (its daily creation cap). */
export async function createdByBotToday(db: Db, botId: string) {
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [row] = await db
    .select({ n: count() })
    .from(botWorkflow)
    .where(and(eq(botWorkflow.botId, botId), eq(botWorkflow.createdByBot, true), gte(botWorkflow.createdAt, dayAgo)));
  return row?.n ?? 0;
}

export async function botIdsOf(db: Db, workflowId: string) {
  const rows = await db
    .select({ id: botWorkflow.botId })
    .from(botWorkflow)
    .where(eq(botWorkflow.workflowId, workflowId));
  return rows.map((row) => row.id);
}

/**
 * Sets which bots may use a workflow. Only the user's own bots are linked; any other id is dropped. A bot that made
 * the workflow keeps its access: sharing never takes away what a bot created.
 */
export async function setSharedBots(db: Db, userId: string, workflowId: string, botIds: string[]) {
  const wanted = [...new Set(botIds)].slice(0, MAX_BOTS_PER_WORKFLOW);
  const owned =
    wanted.length === 0
      ? []
      : await db
          .select({ id: bot.id })
          .from(bot)
          .where(and(eq(bot.userId, userId), inArray(bot.id, wanted)));
  const keep = new Set(owned.map((b) => b.id));

  const current = await db.select().from(botWorkflow).where(eq(botWorkflow.workflowId, workflowId));
  const drop = current.filter((row) => !row.createdByBot && !keep.has(row.botId)).map((row) => row.botId);
  if (drop.length > 0) {
    await db.delete(botWorkflow).where(and(eq(botWorkflow.workflowId, workflowId), inArray(botWorkflow.botId, drop)));
  }
  for (const botId of keep) await grantBot(db, botId, workflowId, false);
  return botIdsOf(db, workflowId);
}
