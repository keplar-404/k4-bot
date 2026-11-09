import { z } from "zod";
import type { Env } from "../../../config/env";
import type { Db } from "../../../db";
import { eq } from "drizzle-orm";
import { agentUsage, botGroup, memoryEvent } from "../../../db/schema";
import { autoMemoryPrompt } from "../../../prompts/auto-memory";
import { chatModelFor } from "../../agent/chat-model";
import { DEFAULT_MODEL_ID } from "../../agent/models";
import { loadMemory, MAX_BOT_MEMORY, MAX_PREFERENCES, saveBotMemory, savePreferences } from "../store";
import { acceptable } from "./validate";

const answer = z.object({
  preferences: z.string().nullable().describe("The complete new PREFERENCES, or null when unchanged."),
  botMemory: z.string().nullable().describe("The complete new BOT MEMORY, or null when unchanged."),
  groupNotes: z.string().nullable().optional().describe("Group chats only: the complete new GROUP NOTES, or null when unchanged."),
});

/** A group's notes are capped like the route's (groups/routes.ts). */
const MAX_GROUP_NOTES = 4000;

export type MemoryUpdate = { eventId: string; scope: "bot" | "preferences" | "group" };
type Turn = {
  userId: string;
  botId: string;
  threadId: string;
  runId: string;
  modelId?: string;
  userText: string;
  /** Set in a group chat: its id, name and current shared notes. */
  group?: { id: string; name: string; memory: string };
};

/** Messages too short to state a lasting fact ("ok", "thanks") are not worth a model call. */
const MIN_CHARS = 12;

/**
 * After a chat turn: lets the bot's own model decide whether the user said something lasting, saves what passes the
 * checks (validate.ts), and records each change so the chat can offer Undo. Never throws: memory is a bonus.
 */
export async function autoUpdateMemory(env: Env, db: Db, turn: Turn): Promise<MemoryUpdate[]> {
  if (!env.OPENROUTER_API_KEY || turn.userText.trim().length < MIN_CHARS) return [];
  try {
    const current = await loadMemory(db, turn.userId, turn.botId);
    const modelId = turn.modelId ?? DEFAULT_MODEL_ID;
    const { createModel } = chatModelFor({ modelId, apiKey: env.OPENROUTER_API_KEY, maxOutputTokens: 1500 });
    const { raw, parsed } = await createModel()
      .withStructuredOutput(answer, { includeRaw: true })
      .invoke([
        { role: "system", content: autoMemoryPrompt(current, turn.group) },
        // The user's words are data to judge, not instructions to follow.
        { role: "user", content: `The user's latest message:\n<data>${turn.userText.slice(0, 6000)}</data>` },
      ]);
    const usage = (raw as { usage_metadata?: { input_tokens?: number; output_tokens?: number } }).usage_metadata;
    await db
      .insert(agentUsage)
      .values({ userId: turn.userId, threadId: turn.threadId, runId: `mem:${turn.runId}`, model: modelId, inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0 })
      .catch(() => undefined);

    const updates: MemoryUpdate[] = [];
    if (acceptable(parsed?.preferences, current.preferences, MAX_PREFERENCES)) {
      await savePreferences(db, turn.userId, parsed.preferences.trim());
      updates.push(await record(db, turn, "preferences", current.preferences, parsed.preferences.trim()));
    }
    if (acceptable(parsed?.botMemory, current.memory, MAX_BOT_MEMORY)) {
      await saveBotMemory(db, turn.userId, turn.botId, parsed.botMemory.trim());
      updates.push(await record(db, turn, "bot", current.memory, parsed.botMemory.trim()));
    }
    if (turn.group && acceptable(parsed?.groupNotes, turn.group.memory, MAX_GROUP_NOTES)) {
      const notes = parsed.groupNotes.trim();
      await db.update(botGroup).set({ memory: notes }).where(eq(botGroup.id, turn.group.id));
      updates.push(await record(db, turn, "group", turn.group.memory, notes));
    }
    return updates;
  } catch (error) {
    console.error("[auto-memory] skipped", (error as Error).message);
    return [];
  }
}

async function record(db: Db, turn: Turn, scope: MemoryUpdate["scope"], before: string, after: string) {
  const id = crypto.randomUUID();
  await db.insert(memoryEvent).values({
    id,
    userId: turn.userId,
    botId: scope === "bot" ? turn.botId : null,
    groupId: scope === "group" ? (turn.group?.id ?? null) : null,
    scope,
    before,
    after,
  });
  return { eventId: id, scope };
}
