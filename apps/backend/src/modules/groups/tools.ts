import { eq } from "drizzle-orm";
import { tool } from "langchain";
import { z } from "zod";
import type { Db } from "../../db";
import { botGroup } from "../../db/schema";
import { looksSecret } from "../memory/auto/validate";
import { memberNamed } from "./mentions";
import type { GroupMember } from "./store";

export const MESSAGE_BOT = "message_bot";
/** Kept short enough that the stored tool call (clipped at 4000 characters) is always whole JSON: chain.ts reads it. */
export const messageBotSchema = z.object({
  bot: z.string().max(80).describe("The member's name, e.g. Writer or @bot:writer."),
  text: z.string().min(1).max(3000).describe("What you need from them, with everything they must know."),
  fileIds: z.array(z.string().max(64)).max(10).optional().describe("Ids of files to hand them (from [file …] lines or tool results)."),
});

/** A group member's tools: hand work to another member, and keep the group's shared notes. */
export function createGroupTools(o: { db: Db; groupId: string; botId: string; members: GroupMember[] }) {
  const messageBot = tool(
    async ({ bot }) => {
      const target = memberNamed(o.members, bot);
      if (!target) return `No member is called "${bot}". Members: ${o.members.map((m) => m.name).join(", ")}.`;
      if (target.id === o.botId) return "That is you. Do the work yourself.";
      return `Sent. ${target.name} answers in the group after you finish this turn. Finish your own part now; do not wait for them.`;
    },
    { name: MESSAGE_BOT, description: "Hand work or a question to another bot in this group chat. It answers in the group after your turn ends.", schema: messageBotSchema },
  );

  const updateNotes = tool(
    async ({ content }) => {
      if (looksSecret(content)) return "Not saved: group notes must not hold passwords, keys or tokens.";
      await o.db.update(botGroup).set({ memory: content }).where(eq(botGroup.id, o.groupId));
      return "Group notes saved. Every member sees them from their next turn.";
    },
    {
      name: "update_group_memory",
      description: "Replace this group's shared notes (decisions, who does what, facts every member should keep). Send the whole new text.",
      schema: z.object({ content: z.string().max(4000) }),
    },
  );
  return [messageBot, updateNotes];
}
