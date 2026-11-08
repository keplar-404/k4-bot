import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { createBotSchema, setBotModelSchema } from "../schemas";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { modelError } from "../../agent/models";
import { domainFor } from "../../agent/domains";
import { bot } from "../../../db/schema";
import { composioAppsOf, composioGate, saveBotComposioApps } from "../composio-apps";
import { deleteBotEverything } from "../delete-bot";
import { integrationLinks, ownedBotId, setBotIntegrations } from "../queries";

const manage = new Hono<AuthGuardEnv>()
  .post("/", userLimit, validate("json", createBotSchema), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { skillIds, mcpServerIds, composioApps, ...fields } = c.req.valid("json");
    // Capabilities the form did not send come from the role (e.g. research bots spawn sub-agents).
    const defaults = domainFor(fields.role).defaults;
    const refused = await composioGate(c, env, userId, composioApps);
    if (refused) return refused;
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
    await saveBotComposioApps(db, created!.id, composioApps);
    return c.json({ bot: { ...created, skillIds: skillIds ?? [], mcpServerIds: mcpServerIds ?? [], composioApps: composioApps ?? [] } }, 201);
  })

  .patch("/:id", userLimit, validate("json", createBotSchema), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { skillIds, mcpServerIds, composioApps, ...fields } = c.req.valid("json");
    const refused = await composioGate(c, env, userId, composioApps);
    if (refused) return refused;
    const [updated] = await db
      .update(bot)
      .set(fields)
      .where(and(eq(bot.id, c.req.param("id")), eq(bot.userId, userId)))
      .returning();
    if (!updated) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
    await setBotIntegrations(db, userId, updated.id, skillIds, mcpServerIds);
    await saveBotComposioApps(db, updated.id, composioApps);
    // The same shape as GET: a client that caches this answer must not lose the bot's skills and apps (a re-save would clear them).
    const [links, apps] = await Promise.all([integrationLinks(db, userId, updated.id), composioAppsOf(db, [updated.id])]);
    return c.json({ bot: { ...updated, skillIds: links.skills.map((l) => l.id), mcpServerIds: links.apps.map((l) => l.id), composioApps: apps.get(updated.id) ?? [] } });
  })

  // The model picked in the prompt bar, saved so it is still selected after a refresh or on another device.
  // Its own route: the avatar form (PATCH above) must never overwrite it, nor this the avatar.
  .put("/:id/model", userLimit, validate("json", setBotModelSchema), async (c) => {
    const { db } = getRequestContext(c);
    const { modelId, reasoningEffort } = c.req.valid("json");
    const invalid = modelError(modelId, reasoningEffort);
    if (invalid) return c.json({ error: "INVALID_INPUT", message: invalid }, 400);
    const [updated] = await db
      .update(bot)
      .set({ modelId, reasoningEffort: reasoningEffort ?? null })
      .where(and(eq(bot.id, c.req.param("id")), eq(bot.userId, c.get("session").user.id)))
      .returning({ id: bot.id });
    if (!updated) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
    return c.json({ ok: true });
  })

  .delete("/:id", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const id = c.req.param("id");
    if (!(await ownedBotId(db, userId, id))) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
    await deleteBotEverything(db, env, userId, id);
    return c.json({ ok: true });
  });

export default manage;
