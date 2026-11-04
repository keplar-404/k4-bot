import { and, count, eq, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { bot, botSandbox } from "../../db/schema";
import { dayOf } from "./policy";

/** Every query is scoped to the owner: a bot id alone never reaches another user's sandbox. */

/** The bot, when it is this user's (null otherwise). */
export const ownedBot = (db: Db, userId: string, botId: string) =>
  db.select({ id: bot.id, name: bot.name }).from(bot).where(and(eq(bot.id, botId), eq(bot.userId, userId))).limit(1).then((r) => r[0] ?? null);

export const getForBot = (db: Db, userId: string, botId: string) =>
  db.select().from(botSandbox).where(and(eq(botSandbox.botId, botId), eq(botSandbox.userId, userId))).limit(1).then((r) => r[0] ?? null);

/** The user's sandboxes with their bots' names, for the management page and sandbox_list_all. */
export const listForUser = (db: Db, userId: string) =>
  db
    .select({
      botId: botSandbox.botId,
      botName: bot.name,
      status: botSandbox.status,
      purpose: botSandbox.purpose,
      createdAt: botSandbox.createdAt,
      lastUsedAt: botSandbox.lastUsedAt,
      usageDay: botSandbox.usageDay,
      usageSeconds: botSandbox.usageSeconds,
    })
    .from(botSandbox)
    .innerJoin(bot, eq(bot.id, botSandbox.botId))
    .where(eq(botSandbox.userId, userId));

export const countForUser = (db: Db, userId: string) =>
  db.select({ n: count() }).from(botSandbox).where(eq(botSandbox.userId, userId)).then((r) => Number(r[0]?.n ?? 0));

/** Seconds the user's sandboxes ran today (UTC). */
export const secondsToday = (db: Db, userId: string) =>
  db
    .select({ s: sql<number>`coalesce(sum(${botSandbox.usageSeconds}), 0)` })
    .from(botSandbox)
    .where(and(eq(botSandbox.userId, userId), eq(botSandbox.usageDay, dayOf(Date.now()))))
    .then((r) => Number(r[0]?.s ?? 0));

export const create = (db: Db, row: { botId: string; userId: string; sandboxId: string; purpose: string; template: string }) =>
  db.insert(botSandbox).values({ ...row, status: "running" });

export const update = (db: Db, userId: string, botId: string, set: Partial<typeof botSandbox.$inferInsert>) =>
  db.update(botSandbox).set(set).where(and(eq(botSandbox.botId, botId), eq(botSandbox.userId, userId)));

export const remove = (db: Db, userId: string, botId: string) =>
  db.delete(botSandbox).where(and(eq(botSandbox.botId, botId), eq(botSandbox.userId, userId)));

/** Rows that say running but were not used for `ms` (the cron safety net pauses them). */
export const staleRunning = (db: Db, ms: number) =>
  db
    .select({ botId: botSandbox.botId, userId: botSandbox.userId })
    .from(botSandbox)
    .where(and(eq(botSandbox.status, "running"), sql`${botSandbox.lastActivityAt} < ${new Date(Date.now() - ms)}`));
