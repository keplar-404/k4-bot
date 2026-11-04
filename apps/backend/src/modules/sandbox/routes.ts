import { Hono } from "hono";
import { authGuard, type AuthGuardEnv } from "../../middleware/auth-guard";
import { userLimit } from "../../middleware/rate-limit";
import { getRequestContext } from "../../shared/context";
import { sandboxFor } from "./sandbox-backend";
import * as store from "./store";

/** The user manages their bots' sandboxes. Every /:botId route first checks the bot is the caller's (404 if not). */
const routes = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .get("/", async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    c.header("Cache-Control", "no-store");
    return c.json({
      sandboxes: await store.listForUser(db, userId),
      limits: { maxPerUser: env.SANDBOX_MAX_PER_USER, maxMinutesPerDay: env.SANDBOX_MAX_MINUTES_PER_DAY, secondsToday: await store.secondsToday(db, userId) },
    });
  })
  .get("/:botId", async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    if (!(await store.ownedBot(db, userId, c.req.param("botId")))) return c.json({ error: "NOT_FOUND" }, 404);
    c.header("Cache-Control", "no-store");
    return c.json({ sandbox: await store.getForBot(db, userId, c.req.param("botId")) });
  })
  .post("/:botId/start", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const botId = c.req.param("botId");
    if (!(await store.ownedBot(db, userId, botId))) return c.json({ error: "NOT_FOUND" }, 404);
    const purpose = (await store.getForBot(db, userId, botId))?.purpose ?? "Started by you";
    const r = await sandboxFor(env, botId).ensure(userId, purpose);
    return r.ok ? c.json({ ok: true }) : c.json({ error: "SANDBOX_UNAVAILABLE", message: r.error }, 409);
  })
  .post("/:botId/pause", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const botId = c.req.param("botId");
    if (!(await store.ownedBot(db, userId, botId))) return c.json({ error: "NOT_FOUND" }, 404);
    const r = await sandboxFor(env, botId).pause(userId);
    return r.ok ? c.json({ ok: true }) : c.json({ error: "SANDBOX_UNAVAILABLE", message: r.error }, 409);
  })
  // Deletes the sandbox in E2B (all its files) and its record.
  .delete("/:botId", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const botId = c.req.param("botId");
    if (!(await store.ownedBot(db, userId, botId))) return c.json({ error: "NOT_FOUND" }, 404);
    const r = await sandboxFor(env, botId).destroy(userId);
    return r.ok ? c.json({ ok: true }) : c.json({ error: "SANDBOX_UNAVAILABLE", message: r.error }, 409);
  });

export default routes;
