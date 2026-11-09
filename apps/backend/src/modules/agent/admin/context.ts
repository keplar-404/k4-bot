import { and, desc, eq, isNull } from "drizzle-orm";
import type { Env } from "../../../config/env";
import type { Db } from "../../../db";
import { adminAudit, bot, chatThread } from "../../../db/schema";
import { threadBusy } from "../../chat/run-busy";
import { computerFor } from "../../computer/sandbox-backend";
import { memberNamed } from "../../groups/mentions";

/** `modelId`: the admin's own run model, used when a bot it messages has none saved (never the paid default). */
export type AdminContext = { env: Env; db: Db; userId: string; botId: string; modelId?: string };

/** The user's bots, by name or id. The admin bot can never reach another user's. */
export async function userBots(ctx: AdminContext) {
  return ctx.db.select({ id: bot.id, name: bot.name, role: bot.role, kind: bot.kind, description: bot.description, modelId: bot.modelId }).from(bot).where(eq(bot.userId, ctx.userId));
}

export async function findBot(ctx: AdminContext, nameOrId: string) {
  const bots = await userBots(ctx);
  return bots.find((b) => b.id === nameOrId) ?? memberNamed(bots, nameOrId) ?? null;
}

/** The bot's latest own chat (not a group chat). */
export async function latestThread(ctx: AdminContext, botId: string) {
  const [row] = await ctx.db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.userId, ctx.userId), eq(chatThread.botId, botId), isNull(chatThread.groupId)))
    .orderBy(desc(chatThread.updatedAt))
    .limit(1);
  return row?.id ?? null;
}

/** Working right now: answering in its chat, or using the computer. */
export async function isBusy(ctx: AdminContext, botId: string) {
  const thread = await latestThread(ctx, botId);
  if (thread && (await threadBusy(ctx.env, ctx.db, thread))) return true;
  if (!ctx.env.COMPUTER_ENABLED || !ctx.env.E2B_API_KEY) return false;
  const status = await computerFor(ctx.env, ctx.userId).status().catch(() => null);
  return Boolean(status?.working.some((w) => w.botId === botId));
}

/** Every change the admin bot makes is recorded for the user. Bookkeeping never fails the action. */
export async function audit(ctx: AdminContext, action: string, detail: Record<string, unknown>) {
  await ctx.db
    .insert(adminAudit)
    .values({ id: crypto.randomUUID(), userId: ctx.userId, botId: ctx.botId, action, detail })
    .catch((e: unknown) => console.error("[admin] audit", e));
}
