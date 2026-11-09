import { tool } from "langchain";
import { z } from "zod";
import { createGroup, deleteGroup, listGroups, updateGroup } from "../../groups/store";
import { cleanupThreads } from "../../chat/cleanup";
import { and, eq } from "drizzle-orm";
import { chatThread } from "../../../db/schema";
import { type AdminContext, audit, findBot } from "./context";

const names = z.array(z.string().max(100)).min(2).max(100);

/** Managing the user's bot groups. */
export function createGroupAdminTools(ctx: AdminContext) {
  const ids = async (botNames: string[]) => {
    const found = await Promise.all(botNames.map((n) => findBot(ctx, n)));
    const missing = botNames.filter((_, i) => !found[i]);
    return missing.length ? { error: `Unknown bots: ${missing.join(", ")}.` } : { ids: found.map((b) => b!.id) };
  };
  const groupNamed = async (name: string) => (await listGroups(ctx.db, ctx.userId)).find((g) => g.name.toLowerCase() === name.trim().toLowerCase() || g.id === name);

  const list = tool(
    async () => {
      const groups = await listGroups(ctx.db, ctx.userId);
      return groups.map((g) => `- ${g.name}: ${g.members.map((m) => m.name + (m.id === g.leadBotId ? " (lead)" : "")).join(", ")}`).join("\n") || "No groups yet.";
    },
    { name: "admin_list_groups", description: "List the user's bot groups and their members.", schema: z.object({}) },
  );

  const create = tool(
    async ({ name, bots, lead }) => {
      const found = await ids(bots);
      if ("error" in found) return found.error;
      const leadBot = lead ? await findBot(ctx, lead) : null;
      const result = await createGroup(ctx.db, ctx.userId, { name, botIds: found.ids, leadBotId: leadBot?.id ?? null });
      if ("error" in result) return result.error;
      await audit(ctx, "create_group", { id: result.group.id, name });
      return `Created the group ${name}. It is in the sidebar under Groups.`;
    },
    { name: "admin_create_group", description: "Create a group chat of two or more of the user's bots, with a lead that answers un-mentioned messages.", schema: z.object({ name: z.string().trim().min(1).max(60), bots: names, lead: z.string().max(100).optional() }) },
  );

  const update = tool(
    async ({ group, newName, bots, lead }) => {
      const g = await groupNamed(group);
      if (!g) return "No group has that name. Call admin_list_groups.";
      const found = bots ? await ids(bots) : null;
      if (found && "error" in found) return found.error;
      const leadBot = lead ? await findBot(ctx, lead) : null;
      const result = await updateGroup(ctx.db, ctx.userId, g.id, { ...(newName ? { name: newName } : {}), ...(found ? { botIds: found.ids } : {}), ...(leadBot ? { leadBotId: leadBot.id } : {}) });
      if ("error" in result) return result.error;
      await audit(ctx, "update_group", { id: g.id, newName, bots, lead });
      return `Updated ${result.group.name}.`;
    },
    { name: "admin_update_group", description: "Rename a group, change its members (send the full list) or its lead.", schema: z.object({ group: z.string().max(60), newName: z.string().trim().min(1).max(60).optional(), bots: names.optional(), lead: z.string().max(100).optional() }) },
  );

  const remove = tool(
    async ({ group }) => {
      const g = await groupNamed(group);
      if (!g) return "No group has that name.";
      const threads = await ctx.db.select({ id: chatThread.id }).from(chatThread).where(and(eq(chatThread.groupId, g.id), eq(chatThread.userId, ctx.userId)));
      await cleanupThreads(ctx.db, ctx.env, threads.map((t) => t.id));
      await deleteGroup(ctx.db, ctx.userId, g.id);
      await audit(ctx, "delete_group", { id: g.id, name: g.name });
      return `Deleted the group ${g.name} and its chat. The bots themselves are kept.`;
    },
    { name: "admin_delete_group", description: "Delete a group and its group chat (the bots stay).", schema: z.object({ group: z.string().max(60) }) },
  );
  return [list, create, update, remove];
}
