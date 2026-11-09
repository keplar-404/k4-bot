import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getRequestContext } from "../../../shared/context";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { publicDomains } from "../../agent/domains";
import { adminAudit, bot } from "../../../db/schema";
import { composioAppsOf } from "../composio-apps";
import { botColumns, idsOf, integrationLinks } from "../queries";

const list = new Hono<AuthGuardEnv>()
  // Per-role defaults and suggestions for the bot form (static: changes only with a deploy).
  .get("/domains", (c) => c.json({ domains: publicDomains() }, 200, { "Cache-Control": "private, max-age=3600" }))

  // What the admin bot changed, newest first (the user's own log only).
  .get("/admin/audit", async (c) => {
    const { db } = getRequestContext(c);
    const items = await db
      .select({ id: adminAudit.id, action: adminAudit.action, detail: adminAudit.detail, createdAt: adminAudit.createdAt })
      .from(adminAudit)
      .where(eq(adminAudit.userId, c.get("session").user.id))
      .orderBy(desc(adminAudit.createdAt))
      .limit(100);
    c.header("Cache-Control", "no-store");
    return c.json({ items });
  })

  .get("/", async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const rows = await db.select(botColumns).from(bot).where(eq(bot.userId, userId)).orderBy(desc(bot.createdAt));
    const [links, apps] = await Promise.all([integrationLinks(db, userId), composioAppsOf(db, rows.map((r) => r.id))]);
    // No HTTP caching: the client keeps its own TTL cache and must never
    // re-serve a stale list over an optimistic create/update/delete.
    c.header("Cache-Control", "no-store");
    return c.json({ bots: rows.map((r) => ({ ...r, skillIds: idsOf(links.skills, r.id), mcpServerIds: idsOf(links.apps, r.id), composioApps: apps.get(r.id) ?? [] })) });
  })

  // One bot with its skill and app links: three small queries scoped to this bot, never the whole list.
  // Someone else's bot id answers 404 exactly like a missing one, so ids cannot be probed.
  .get("/:id", async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const id = c.req.param("id");
    const [row] = await db
      .select(botColumns)
      .from(bot)
      .where(and(eq(bot.id, id), eq(bot.userId, userId)))
      .limit(1);
    if (!row) return c.json({ error: "NOT_FOUND", message: "Bot not found" }, 404);
    const [links, apps] = await Promise.all([integrationLinks(db, userId, id), composioAppsOf(db, [id])]);
    c.header("Cache-Control", "no-store");
    return c.json({ bot: { ...row, skillIds: links.skills.map((s) => s.id), mcpServerIds: links.apps.map((a) => a.id), composioApps: apps.get(id) ?? [] } });
  });

export default list;
