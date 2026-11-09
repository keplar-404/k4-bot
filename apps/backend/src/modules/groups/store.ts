import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Db } from "../../db";
import { bot, botGroup, botGroupMember, chatThread } from "../../db/schema";

export type GroupMember = { id: string; name: string; role: string; shape: string; color: string; expression: string };
export type GroupInput = { name: string; botIds: string[]; leadBotId?: string | null };

const memberCols = { id: bot.id, name: bot.name, role: bot.role, shape: bot.shape, color: bot.color, expression: bot.expression };

/** Members in the order they joined; the lead is whoever the group names, else the first member. */
export async function groupMembers(db: Db, groupId: string): Promise<GroupMember[]> {
  return db
    .select(memberCols)
    .from(botGroupMember)
    .innerJoin(bot, eq(bot.id, botGroupMember.botId))
    .where(eq(botGroupMember.groupId, groupId))
    .orderBy(asc(botGroupMember.addedAt), asc(bot.name));
}

export const leadOf = (group: { leadBotId: string | null }, members: GroupMember[]) =>
  members.find((m) => m.id === group.leadBotId) ?? members[0] ?? null;

export async function getOwnedGroup(db: Db, userId: string, id: string) {
  const [row] = await db.select().from(botGroup).where(and(eq(botGroup.id, id), eq(botGroup.userId, userId))).limit(1);
  return row ?? null;
}

export async function listGroups(db: Db, userId: string) {
  const groups = await db.select().from(botGroup).where(eq(botGroup.userId, userId)).orderBy(asc(botGroup.name));
  return Promise.all(groups.map(async (g) => ({ ...g, members: await groupMembers(db, g.id) })));
}

/** Only the user's own bots may join; returns the unknown ids so the caller can refuse. */
async function ownBots(db: Db, userId: string, ids: string[]) {
  const rows = ids.length ? await db.select({ id: bot.id }).from(bot).where(and(eq(bot.userId, userId), inArray(bot.id, ids))) : [];
  const own = new Set(rows.map((r) => r.id));
  return ids.filter((id) => !own.has(id));
}

function checkInput(input: GroupInput): string | null {
  if (new Set(input.botIds).size < 2) return "A group needs at least two different bots.";
  if (input.leadBotId && !input.botIds.includes(input.leadBotId)) return "The lead must be one of the group's bots.";
  return null;
}

export async function createGroup(db: Db, userId: string, input: GroupInput) {
  const problem = checkInput(input) ?? ((await ownBots(db, userId, input.botIds)).length ? "Unknown bot." : null);
  if (problem) return { error: problem } as const;
  const id = crypto.randomUUID();
  const [group] = await db.insert(botGroup).values({ id, userId, name: input.name, leadBotId: input.leadBotId ?? input.botIds[0]! }).returning();
  await db.insert(botGroupMember).values([...new Set(input.botIds)].map((botId) => ({ groupId: id, botId })));
  return { group: { ...group!, members: await groupMembers(db, id) } } as const;
}

export async function updateGroup(db: Db, userId: string, id: string, patch: Partial<GroupInput> & { memory?: string }) {
  const group = await getOwnedGroup(db, userId, id);
  if (!group) return { error: "NOT_FOUND" } as const;
  if (patch.botIds) {
    const problem = checkInput({ name: group.name, botIds: patch.botIds, leadBotId: patch.leadBotId ?? null }) ?? ((await ownBots(db, userId, patch.botIds)).length ? "Unknown bot." : null);
    if (problem) return { error: problem } as const;
    const keep = new Set(patch.botIds);
    const current = await groupMembers(db, id);
    const gone = current.filter((m) => !keep.has(m.id)).map((m) => m.id);
    if (gone.length) await db.delete(botGroupMember).where(and(eq(botGroupMember.groupId, id), inArray(botGroupMember.botId, gone)));
    const added = patch.botIds.filter((b) => !current.some((m) => m.id === b));
    if (added.length) await db.insert(botGroupMember).values(added.map((botId) => ({ groupId: id, botId }))).onConflictDoNothing();
  }
  const members = await groupMembers(db, id);
  if (patch.leadBotId && !members.some((m) => m.id === patch.leadBotId)) return { error: "The lead must be one of the group's bots." } as const;
  const set = { ...(patch.name ? { name: patch.name } : {}), ...(patch.leadBotId ? { leadBotId: patch.leadBotId } : {}), ...(patch.memory !== undefined ? { memory: patch.memory } : {}) };
  const [updated] = Object.keys(set).length ? await db.update(botGroup).set(set).where(eq(botGroup.id, id)).returning() : [group];
  return { group: { ...updated!, members } } as const;
}

export async function deleteGroup(db: Db, userId: string, id: string) {
  const deleted = await db.delete(botGroup).where(and(eq(botGroup.id, id), eq(botGroup.userId, userId))).returning({ id: botGroup.id });
  return deleted.length > 0;
}

/** Before a bot is deleted: group chats it is the thread bot of move to another member of that group. */
export async function handOverGroupThreads(db: Db, userId: string, botId: string) {
  const other = sql`(select m.bot_id from bot_group_member m where m.group_id = ${chatThread.groupId} and m.bot_id <> ${botId} order by m.added_at limit 1)`;
  await db
    .update(chatThread)
    .set({ botId: sql`coalesce(${other}, ${chatThread.botId})` })
    .where(and(eq(chatThread.userId, userId), eq(chatThread.botId, botId), isNotNull(chatThread.groupId)));
}
