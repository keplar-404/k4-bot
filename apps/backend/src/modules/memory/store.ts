import { and, eq } from "drizzle-orm";
import type { Db } from "../../db";
import { bot, botMemory, userPreferences } from "../../db/schema";

/** Kept short on purpose: both are sent with every model call of the bot. */
export const MAX_BOT_MEMORY = 8000;
export const MAX_PREFERENCES = 4000;

/** This bot's own memory and the user's global preferences (two small reads, no third party). */
export async function loadMemory(db: Db, userId: string, botId: string): Promise<{ memory: string; preferences: string }> {
  const [[mem], [prefs]] = await Promise.all([
    db.select({ content: botMemory.content }).from(botMemory).where(and(eq(botMemory.botId, botId), eq(botMemory.userId, userId))).limit(1),
    db.select({ content: userPreferences.content }).from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1),
  ]);
  return { memory: mem?.content ?? "", preferences: prefs?.content ?? "" };
}

/** Replaces a bot's memory. Returns false when the bot is not this user's. */
export async function saveBotMemory(db: Db, userId: string, botId: string, content: string): Promise<boolean> {
  const [owned] = await db.select({ id: bot.id }).from(bot).where(and(eq(bot.id, botId), eq(bot.userId, userId))).limit(1);
  if (!owned) return false;
  await db
    .insert(botMemory)
    .values({ botId, userId, content })
    .onConflictDoUpdate({ target: botMemory.botId, set: { content, updatedAt: new Date() } });
  return true;
}

export async function savePreferences(db: Db, userId: string, content: string): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, content })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { content, updatedAt: new Date() } });
}
