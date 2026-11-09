import { and, eq } from "drizzle-orm";
import type { Db } from "../../../db";
import { botGroup, memoryEvent } from "../../../db/schema";
import { getOwnedGroup } from "../../groups/store";
import { loadMemory, saveBotMemory, savePreferences } from "../store";

/**
 * Undo of an automatic memory update: restores what was there before, only if the memory still holds what the update
 * wrote (a later edit by the user or the bot is never overwritten). The event is removed so it cannot run twice.
 */
export async function undoMemoryEvent(db: Db, userId: string, eventId: string): Promise<"undone" | "not_found" | "changed"> {
  const [event] = await db
    .select()
    .from(memoryEvent)
    .where(and(eq(memoryEvent.id, eventId), eq(memoryEvent.userId, userId)))
    .limit(1);
  if (!event) return "not_found";
  if (event.scope === "group") {
    // The group's shared notes: the same rule, on the group the user owns.
    const group = event.groupId ? await getOwnedGroup(db, userId, event.groupId) : null;
    if (!group) return "not_found";
    if (group.memory.trim() !== event.after.trim()) return "changed";
    await db.update(botGroup).set({ memory: event.before }).where(eq(botGroup.id, group.id));
  } else {
    const current = await loadMemory(db, userId, event.botId ?? "");
    const now = event.scope === "bot" ? current.memory : current.preferences;
    if (now.trim() !== event.after.trim()) return "changed";
    if (event.scope === "bot" && event.botId) await saveBotMemory(db, userId, event.botId, event.before);
    else await savePreferences(db, userId, event.before);
  }
  await db.delete(memoryEvent).where(eq(memoryEvent.id, eventId));
  return "undone";
}
