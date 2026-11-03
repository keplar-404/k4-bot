import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { getRequestContext } from "../lib/context";
import { validate } from "../lib/validate";
import { createBotSchema, setBotModelSchema } from "../lib/schemas/bot";
import { authGuard, type AuthGuardEnv } from "../middleware/auth-guard";
import { userLimit } from "../middleware/rate-limit";
import { computerFor } from "../computer/sandbox-backend";
import { cleanupThreads } from "../lib/cleanup";
import { resolveModel } from "../agent/models";
import { domainFor, publicDomains } from "../agent/domains";
import { bot, botMcpServer, botSkill, chatThread, userMcpServer, userSkill } from "../db/schema";

/**
 * Replaces a bot's skills and connected apps with the given ones, keeping only those the user owns (an id from
 * another account is dropped, never linked). Omitted lists are left as they are.
 */
async function setBotIntegrations(db: Db, userId: string, botId: string, skillIds?: string[], mcpServerIds?: string[]) {
  if (skillIds) {
    const owned = skillIds.length
      ? await db.select({ id: userSkill.id }).from(userSkill).where(and(eq(userSkill.userId, userId), inArray(userSkill.id, skillIds)))
      : [];
    await db.delete(botSkill).where(eq(botSkill.botId, botId));
    if (owned.length) await db.insert(botSkill).values(owned.map((s) => ({ botId, userSkillId: s.id })));
  }
  if (mcpServerIds) {
    const owned = mcpServerIds.length
      ? await db.select({ id: userMcpServer.id }).from(userMcpServer).where(and(eq(userMcpServer.userId, userId), inArray(userMcpServer.id, mcpServerIds)))
      : [];
    await db.delete(botMcpServer).where(eq(botMcpServer.botId, botId));
    if (owned.length) await db.insert(botMcpServer).values(owned.map((s) => ({ botId, userMcpServerId: s.id })));
  }
}

const bots = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  // Per-role defaults and suggestions for the bot form (static: changes only with a deploy).
  .get("/domains", (c) => c.json({ domains: publicDomains() }, 200, { "Cache-Control": "private, max-age=3600" }))

  .get("/", async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const [rows, skills, apps] = await Promise.all([
      db
      .select({
        id: bot.id,
        name: bot.name,
        description: bot.description,
        role: bot.role,
        roleTitle: bot.roleTitle,
        subagentsEnabled: bot.subagentsEnabled,
        maxSubagents: bot.maxSubagents,
        maxParallelTools: bot.maxParallelTools,
        shape: bot.shape,
        color: bot.color,
        expression: bot.expression,
        modelId: bot.modelId,
        reasoningEffort: bot.reasoningEffort,
      })
      .from(bot)
      .where(eq(bot.userId, userId))
      .orderBy(desc(bot.createdAt)),
      db
        .select({ botId: botSkill.botId, id: botSkill.userSkillId })
        .from(botSkill)
        .innerJoin(userSkill, eq(userSkill.id, botSkill.userSkillId))
        .where(eq(userSkill.userId, userId)),
      db
        .select({ botId: botMcpServer.botId, id: botMcpServer.userMcpServerId })
        .from(botMcpServer)
        .innerJoin(userMcpServer, eq(userMcpServer.id, botMcpServer.userMcpServerId))
        .where(eq(userMcpServer.userId, userId)),
    ]);
    const idsOf = (links: Array<{ botId: string; id: string }>, botId: string) => links.filter((l) => l.botId === botId).map((l) => l.id);
    // No HTTP caching: the client keeps its own TTL cache and must never
    // re-serve a stale list over an optimistic create/update/delete.
    c.header("Cache-Control", "no-store");
    return c.json({ bots: rows.map((r) => ({ ...r, skillIds: idsOf(skills, r.id), mcpServerIds: idsOf(apps, r.id) })) });
  })

  .post("/", userLimit, validate("json", createBotSchema), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { skillIds, mcpServerIds, ...fields } = c.req.valid("json");
    // Capabilities the form did not send come from the role (e.g. research bots spawn sub-agents).
    const defaults = domainFor(fields.role).defaults;
    const [created] = await db
      .insert(bot)
      .values({
        id: crypto.randomUUID(),
        userId,
        ...fields,
        subagentsEnabled: fields.subagentsEnabled ?? defaults.subagents,
        maxSubagents: fields.maxSubagents ?? defaults.maxSubagents,
        maxParallelTools: fields.maxParallelTools ?? defaults.maxParallelTools,
      })
      .returning();
    await setBotIntegrations(db, userId, created!.id, skillIds, mcpServerIds);
    return c.json({ bot: { ...created, skillIds: skillIds ?? [], mcpServerIds: mcpServerIds ?? [] } }, 201);
  })

  .patch("/:id", userLimit, validate("json", createBotSchema), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { skillIds, mcpServerIds, ...fields } = c.req.valid("json");
    const [updated] = await db
      .update(bot)
      .set(fields)
      .where(and(eq(bot.id, c.req.param("id")), eq(bot.userId, userId)))
      .returning();
    if (!updated) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
    await setBotIntegrations(db, userId, updated.id, skillIds, mcpServerIds);
    return c.json({ bot: updated });
  })

  // The model picked in the prompt bar, saved so it is still selected after a refresh or on another device.
  // Its own route: the avatar form (PATCH above) must never overwrite it, nor this the avatar.
  .put("/:id/model", userLimit, validate("json", setBotModelSchema), async (c) => {
    const { db } = getRequestContext(c);
    const { modelId, reasoningEffort } = c.req.valid("json");
    const model = resolveModel(modelId);
    if (!model) return c.json({ error: "INVALID_INPUT", message: "Unknown model" }, 400);
    if (reasoningEffort && !model.reasoningEfforts.includes(reasoningEffort)) {
      return c.json({ error: "INVALID_INPUT", message: "Unsupported reasoning effort" }, 400);
    }
    const [updated] = await db
      .update(bot)
      .set({ modelId, reasoningEffort: reasoningEffort ?? null })
      .where(and(eq(bot.id, c.req.param("id")), eq(bot.userId, c.get("session").user.id)))
      .returning({ id: bot.id });
    if (!updated) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
    return c.json({ ok: true });
  })

  /**
   * Deletes the bot and everything it owns: its running work is stopped, its chats go with it (the
   * database cascades threads, messages and events), its agent memory is removed, and its Linux account
   * and files are removed from the user's computer (now if it is awake, otherwise on its next wake).
   */
  .delete("/:id", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const id = c.req.param("id");

    const [owned] = await db
      .select({ id: bot.id })
      .from(bot)
      .where(and(eq(bot.id, id), eq(bot.userId, userId)))
      .limit(1);
    if (!owned) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);

    const threads = await db
      .select({ id: chatThread.id })
      .from(chatThread)
      .where(and(eq(chatThread.botId, id), eq(chatThread.userId, userId)));
    // Stop its runs first, so nothing writes to rows that are about to go.
    await cleanupThreads(db, env, threads.map((t) => t.id));
    await db.delete(bot).where(and(eq(bot.id, id), eq(bot.userId, userId)));
    // Its files on the computer. A failure here must not undo the deletion above: its runs are stopped
    // and its threads are gone (every run slice checks its thread still exists), so nothing uses it again.
    await computerFor(env, userId)
      .removeBot(id)
      .catch((e: unknown) => console.error("[bots] computer cleanup failed", e));
    return c.json({ ok: true });
  });

export default bots;
