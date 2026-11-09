import type { InterruptOnConfig } from "langchain";
import { createBotAdminTools } from "./bot-tools";
import type { AdminContext } from "./context";
import { createGroupAdminTools } from "./group-tools";
import { createWorkAdminTools } from "./work-tools";

const ask = (description: string): InterruptOnConfig => ({ allowedDecisions: ["approve", "reject"], description });

/**
 * The admin bot's tools: the user's other bots, groups and their folders on the computer (never another user's,
 * never deleting Linux users itself). Everything that changes something asks first in Ask mode; deleting a bot
 * asks even in Allow all (agent/modes.ts ALWAYS_ASK).
 */
export function adminTools(ctx: AdminContext) {
  return {
    tools: [...createBotAdminTools(ctx), ...createGroupAdminTools(ctx), ...createWorkAdminTools(ctx)],
    approvals: {
      admin_create_bot: ask("Create this bot?"),
      admin_update_bot: ask("Change this bot?"),
      admin_delete_bot: ask("Delete this bot, its chats and its files? This cannot be undone."),
      admin_set_bot_memory: ask("Replace this bot's memory?"),
      admin_create_group: ask("Create this group?"),
      admin_update_group: ask("Change this group?"),
      admin_delete_group: ask("Delete this group and its chat?"),
      admin_message_bot: ask("Send this message to the bot?"),
      admin_run_as_bot: ask("Run this command in the other bot's folder?"),
    },
  };
}
