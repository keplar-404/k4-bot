import { and, eq } from "drizzle-orm";
import { tool } from "langchain";
import { z } from "zod";
import { bot } from "../../../db/schema";
import { deleteBotEverything } from "../../bots/delete-bot";
import { ROLE_IDS } from "../../bots/roles";
import { saveBotMemory } from "../../memory/store";
import { domainFor } from "../domains";
import { type AdminContext, audit, findBot, isBusy, userBots } from "./context";

const NOT_FOUND = "No bot of the user has that name. Call admin_list_bots.";
const AVATAR = { shape: "galet", color: "bleu", expression: "heureux" } as const;

/** Managing the user's other bots: list, create, change, delete, and set a bot's memory. */
export function createBotAdminTools(ctx: AdminContext) {
  const list = tool(
    async () => {
      const bots = await userBots(ctx);
      const lines = await Promise.all(bots.map(async (b) => `- ${b.name} (${b.role}${b.kind === "admin" ? ", admin: you" : ""})${(await isBusy(ctx, b.id)) ? " — working now" : ""}${b.description ? `: ${b.description.slice(0, 120)}` : ""}`));
      return lines.join("\n") || "The user has no bots.";
    },
    { name: "admin_list_bots", description: "List the user's bots with their roles and whether each is working right now.", schema: z.object({}) },
  );

  const create = tool(
    async ({ name, role, description }) => {
      const d = domainFor(role).defaults;
      const [row] = await ctx.db
        .insert(bot)
        .values({ id: crypto.randomUUID(), userId: ctx.userId, name, role, description: description ?? "", ...AVATAR, subagentsEnabled: d.subagents, maxSubagents: d.maxSubagents, maxParallelTools: d.maxParallelTools })
        .returning({ id: bot.id });
      await audit(ctx, "create_bot", { id: row!.id, name, role });
      return `Created ${name}. The user can change its look, skills and apps on its settings page.`;
    },
    {
      name: "admin_create_bot",
      description: "Create a new bot for the user.",
      schema: z.object({ name: z.string().trim().min(1).max(100), role: z.enum(ROLE_IDS.filter((r) => r !== "custom") as [string, ...string[]]), description: z.string().max(500).optional() }),
    },
  );

  const update = tool(
    async ({ bot: name, newName, description }) => {
      const target = await findBot(ctx, name);
      if (!target) return NOT_FOUND;
      await ctx.db.update(bot).set({ ...(newName ? { name: newName } : {}), ...(description !== undefined ? { description } : {}) }).where(and(eq(bot.id, target.id), eq(bot.userId, ctx.userId)));
      await audit(ctx, "update_bot", { id: target.id, newName, description });
      return `Updated ${target.name}.`;
    },
    { name: "admin_update_bot", description: "Rename a bot or change its description.", schema: z.object({ bot: z.string().max(100), newName: z.string().trim().min(1).max(100).optional(), description: z.string().max(500).optional() }) },
  );

  const remove = tool(
    async ({ bot: name }) => {
      const target = await findBot(ctx, name);
      if (!target) return NOT_FOUND;
      if (target.kind === "admin") return "You cannot delete yourself.";
      if (await isBusy(ctx, target.id)) return `${target.name} is working right now. Wait until it has finished, then ask again.`;
      await deleteBotEverything(ctx.db, ctx.env, ctx.userId, target.id);
      await audit(ctx, "delete_bot", { id: target.id, name: target.name });
      return `Deleted ${target.name}, with its chats and its files on the computer.`;
    },
    { name: "admin_delete_bot", description: "Delete one of the user's bots for good (its chats and computer files too). The user is always asked first.", schema: z.object({ bot: z.string().max(100) }) },
  );

  const memory = tool(
    async ({ bot: name, content }) => {
      const target = await findBot(ctx, name);
      if (!target) return NOT_FOUND;
      await saveBotMemory(ctx.db, ctx.userId, target.id, content);
      await audit(ctx, "set_bot_memory", { id: target.id });
      return `Saved ${target.name}'s memory.`;
    },
    { name: "admin_set_bot_memory", description: "Replace another bot's long-term memory (send the whole new text).", schema: z.object({ bot: z.string().max(100), content: z.string().max(8000) }) },
  );
  return [list, create, update, remove, memory];
}
