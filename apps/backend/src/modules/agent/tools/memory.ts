import { tool } from "langchain";
import { z } from "zod";
import { MAX_BOT_MEMORY, MAX_PREFERENCES } from "../../memory/store";

export interface MemoryToolsOptions {
  saveMemory: (content: string) => Promise<void>;
  savePreferences: (content: string) => Promise<void>;
}

/**
 * Long-term memory. Both tools replace the whole text (the current text is in the system prompt), so the bot
 * keeps it tidy instead of appending forever. Sub-agents never get them.
 */
export function createMemoryTools(o: MemoryToolsOptions) {
  const memory = tool(
    async ({ content }) => {
      await o.saveMemory(content.trim());
      return "Saved. Your memory now holds exactly this text.";
    },
    {
      name: "update_memory",
      description:
        "Rewrite YOUR long-term memory: notes only you (this bot) keep across all your chats, e.g. ongoing projects, decisions, facts about the work, what worked. " +
        "Pass the FULL new text (the current memory is in your instructions): keep what is still true, add what is new, drop what is outdated. Short bullet points. " +
        "Save only lasting facts, never one-off details or secrets (passwords, keys, card numbers). Never put the user's general preferences here; use update_user_preferences.",
      schema: z.object({ content: z.string().max(MAX_BOT_MEMORY).describe("The complete new memory, markdown bullets.") }),
    },
  );

  const preferences = tool(
    async ({ content }) => {
      await o.savePreferences(content.trim());
      return "Saved. The user's preferences now hold exactly this text, for all of their bots.";
    },
    {
      name: "update_user_preferences",
      description:
        "Rewrite the user's GLOBAL preferences, shared by all of their bots: how to address them, language, tone, answer length and format, timezone, units, tools they use. " +
        "Call it when the user states or clearly shows a lasting preference (for example: always answer in Bangla, call me Sam). " +
        "Pass the FULL new text (the current preferences are in your instructions): keep the rest, change only what the user changed. Short bullet points, no secrets.",
      schema: z.object({ content: z.string().max(MAX_PREFERENCES).describe("The complete new preferences, markdown bullets.") }),
    },
  );

  return [memory, preferences];
}
