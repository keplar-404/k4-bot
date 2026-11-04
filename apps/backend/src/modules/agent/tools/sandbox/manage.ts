import { tool } from "langchain";
import { z } from "zod";
import { sandboxFor } from "../../../sandbox/sandbox-backend";
import * as store from "../../../sandbox/store";
import { asText, type SandboxToolOptions } from "./helpers";

/**
 * Seeing and deleting the user's sandboxes. sandbox_delete is in `interruptOn` (approvals.ts): the user approves it
 * after seeing the bot, purpose and last use it names; the tool then checks those match the real sandbox, so the user
 * never approves something other than what is deleted.
 */
export function createSandboxManageTools(o: SandboxToolOptions) {
  const listAll = tool(
    async () => {
      const rows = await store.listForUser(o.db, o.userId);
      if (rows.length === 0) return "The user has no sandboxes.";
      return rows.map((r) => `- bot "${r.botName}" (bot_id ${r.botId}): ${r.status}, purpose "${r.purpose}", last used ${r.lastUsedAt.toISOString()}`).join("\n");
    },
    { name: "sandbox_list_all", description: "List all of the user's sandboxes (one per bot): owner bot, status, purpose, last used.", schema: z.object({}) },
  );

  const remove = tool(
    async ({ bot_id, bot_name, purpose }) => {
      const row = (await store.listForUser(o.db, o.userId)).find((r) => r.botId === bot_id);
      if (!row) return "NOT DONE: no sandbox for that bot. Call sandbox_list_all.";
      if (row.botName !== bot_name || row.purpose !== purpose) return "NOT DONE: the bot name or purpose did not match that sandbox. Call sandbox_list_all and ask again.";
      return asText(sandboxFor(o.env, bot_id).destroy(o.userId), () => `Deleted the sandbox of "${bot_name}" and all its files.`);
    },
    {
      name: "sandbox_delete",
      description:
        "Delete a sandbox and ALL its files (yours or another bot's). Always needs the user's approval. Call sandbox_list_all first and pass that sandbox's exact bot name and purpose, so the user sees what is deleted.",
      schema: z.object({
        bot_id: z.string(),
        bot_name: z.string().describe("Exactly as listed by sandbox_list_all."),
        purpose: z.string().describe("Exactly as listed by sandbox_list_all."),
        last_used: z.string().describe("As listed, shown to the user."),
      }),
    },
  );
  return [listAll, remove];
}
