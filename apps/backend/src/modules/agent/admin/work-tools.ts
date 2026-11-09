import { tool } from "langchain";
import { z } from "zod";
import { chatThread } from "../../../db/schema";
import type { ChatRunParams } from "../../chat/run/types";
import { threadBusy } from "../../chat/run-busy";
import { computerFor } from "../../computer/sandbox-backend";
import { type AdminContext, audit, findBot, latestThread } from "./context";

/** Reaching the user's other bots: send one a message, and work in its folder on the computer. */
export function createWorkAdminTools(ctx: AdminContext) {
  const message = tool(
    async ({ bot: name, text }) => {
      const target = await findBot(ctx, name);
      if (!target || target.id === ctx.botId) return "No other bot of the user has that name.";
      let threadId = await latestThread(ctx, target.id);
      if (threadId && (await threadBusy(ctx.env, ctx.db, threadId))) return `${target.name} is busy with another message. Try again later.`;
      if (!threadId) {
        threadId = crypto.randomUUID();
        await ctx.db.insert(chatThread).values({ id: threadId, botId: target.id, userId: ctx.userId, title: "From the admin bot" });
      }
      const runId = crypto.randomUUID();
      // The bot's own saved model, else the one the admin runs on: never the server's (paid) default by accident.
      const modelId = target.modelId ?? ctx.modelId;
      const params: ChatRunParams = { runId, threadId, userId: ctx.userId, userMessageId: runId, content: `[From the admin bot] ${text}`, modelId };
      await ctx.env.CHAT_RUN.create({ id: runId, params });
      await audit(ctx, "message_bot", { id: target.id });
      return `Sent to ${target.name}; it answers in its own chat (the user can read it there).`;
    },
    { name: "admin_message_bot", description: "Send one of the user's bots a message in its own chat. It works on it there.", schema: z.object({ bot: z.string().max(100), text: z.string().min(1).max(4000) }) },
  );

  const runAs = tool(
    async ({ bot: name, command }) => {
      if (!ctx.env.COMPUTER_ENABLED || !ctx.env.E2B_API_KEY) return "The computer is not available on this server.";
      const target = await findBot(ctx, name);
      if (!target || target.id === ctx.botId) return "No other bot of the user has that name. For your own folder use execute.";
      const r = await computerFor(ctx.env, ctx.userId).execAsBot(ctx.botId, target.id, command);
      await audit(ctx, "run_as_bot", { id: target.id, command: command.slice(0, 500), exitCode: r.exitCode });
      return `exit ${r.exitCode}\n${r.output}${r.truncated ? "\n…[output cut]" : ""}`;
    },
    {
      name: "admin_run_as_bot",
      description:
        "Run a shell command on the computer AS another bot, in its home folder: you can create, change and delete that bot's files (not other accounts, not root). Refused while that bot is working. Before deleting its files, ask the user.",
      schema: z.object({ bot: z.string().max(100), command: z.string().min(1).max(20_000) }),
    },
  );
  return [message, runAs];
}
