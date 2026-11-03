import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db";
import { bot, botMcpServer, botSkill, userMcpServer, userSkill } from "../../db/schema";

/** The bot fields the client reads, shared by the list and the single-bot route so they cannot drift apart. */
export const botColumns = {
  id: bot.id,
  name: bot.name,
  description: bot.description,
  role: bot.role,
  roleTitle: bot.roleTitle,
  subagentsEnabled: bot.subagentsEnabled,
  maxSubagents: bot.maxSubagents,
  maxParallelTools: bot.maxParallelTools,
  shape: bot.shape,
  color: bot.color,
  expression: bot.expression,
  modelId: bot.modelId,
  reasoningEffort: bot.reasoningEffort,
};

export type IntegrationLink = { botId: string; id: string };

/** The user's skill and app links (bot id + installed id), of every bot or only of `botId`. */
export async function integrationLinks(db: Db, userId: string, botId?: string): Promise<{ skills: IntegrationLink[]; apps: IntegrationLink[] }> {
  const [skills, apps] = await Promise.all([
    db
      .select({ botId: botSkill.botId, id: botSkill.userSkillId })
      .from(botSkill)
      .innerJoin(userSkill, eq(userSkill.id, botSkill.userSkillId))
      .where(and(eq(userSkill.userId, userId), botId ? eq(botSkill.botId, botId) : undefined)),
    db
      .select({ botId: botMcpServer.botId, id: botMcpServer.userMcpServerId })
      .from(botMcpServer)
      .innerJoin(userMcpServer, eq(userMcpServer.id, botMcpServer.userMcpServerId))
      .where(and(eq(userMcpServer.userId, userId), botId ? eq(botMcpServer.botId, botId) : undefined)),
  ]);
  return { skills, apps };
}

export const idsOf = (links: IntegrationLink[], botId: string) => links.filter((l) => l.botId === botId).map((l) => l.id);

/** The bot, if `userId` owns it. */
export async function ownedBotId(db: Db, userId: string, botId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: bot.id })
    .from(bot)
    .where(and(eq(bot.id, botId), eq(bot.userId, userId)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Replaces a bot's skills and connected apps with the given ones, keeping only those the user owns (an id from
 * another account is dropped, never linked). Omitted lists are left as they are.
 */
export async function setBotIntegrations(db: Db, userId: string, botId: string, skillIds?: string[], mcpServerIds?: string[]) {
  if (skillIds) {
    const owned = skillIds.length
      ? await db.select({ id: userSkill.id }).from(userSkill).where(and(eq(userSkill.userId, userId), inArray(userSkill.id, skillIds)))
      : [];
    await db.delete(botSkill).where(eq(botSkill.botId, botId));
    if (owned.length) await db.insert(botSkill).values(owned.map((s) => ({ botId, userSkillId: s.id })));
  }
  if (mcpServerIds) {
    const owned = mcpServerIds.length
      ? await db.select({ id: userMcpServer.id }).from(userMcpServer).where(and(eq(userMcpServer.userId, userId), inArray(userMcpServer.id, mcpServerIds)))
      : [];
    await db.delete(botMcpServer).where(eq(botMcpServer.botId, botId));
    if (owned.length) await db.insert(botMcpServer).values(owned.map((s) => ({ botId, userMcpServerId: s.id })));
  }
}
