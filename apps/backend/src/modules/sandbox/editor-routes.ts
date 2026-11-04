import { Hono } from "hono";
import { z } from "zod";
import { authGuard, type AuthGuardEnv } from "../../middleware/auth-guard";
import { userLimit } from "../../middleware/rate-limit";
import { getRequestContext } from "../../shared/context";
import { signRelayToken, verifyRelayToken } from "../../shared/relay-token";
import { validate } from "../../shared/validate";
import { secretOf } from "../computer/routes/novnc";
import { sandboxFor } from "./sandbox-backend";
import * as store from "./store";

const scope = (botId: string) => `sandbox:${botId}`;
/** A token for the editor's socket: as long as an editing session, re-minted on reconnect. */
const EDITOR_TOKEN_SECONDS = 30 * 60;

/**
 * The code editor page. The WebSocket route sits before authGuard (a socket cannot carry the API's headers); it is
 * gated by a short-lived HMAC token that only `open` mints, for a bot the caller owns.
 */
const editor = new Hono<AuthGuardEnv>()
  .get("/:botId/ws", async (c) => {
    const { env } = getRequestContext(c);
    const botId = c.req.param("botId");
    const userId = c.req.query("userId") ?? "";
    const ok = await verifyRelayToken({ secret: secretOf(env), token: c.req.query("token") ?? "", userId, threadId: scope(botId) });
    if (!ok) return c.json({ error: "UNAUTHORIZED" }, 401);
    const res = await sandboxFor(env, botId).fetch(new Request("https://sandbox/ws", { headers: { Upgrade: "websocket", "x-sandbox-user": userId } }));
    return new Response(res.webSocket ? null : res.body, res);
  })
  .use("/:botId/*", authGuard)
  // Opening the editor wakes the sandbox (it stays awake while the editor is connected) and returns the socket token.
  .post("/:botId/open", userLimit, async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const botId = c.req.param("botId");
    if (!(await store.ownedBot(db, userId, botId))) return c.json({ error: "NOT_FOUND" }, 404);
    const row = await store.getForBot(db, userId, botId);
    if (!row) return c.json({ error: "NO_SANDBOX", message: "This bot has no sandbox yet. Ask it to start one." }, 404);
    const r = await sandboxFor(env, botId).ensure(userId, row.purpose);
    if (!r.ok) return c.json({ error: "SANDBOX_UNAVAILABLE", message: r.error }, 409);
    const token = await signRelayToken({ secret: secretOf(env), userId, threadId: scope(botId), ttlSeconds: EDITOR_TOKEN_SECONDS });
    return c.json({ token, userId });
  })
  .get("/:botId/tree", async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    if (!(await store.ownedBot(db, userId, c.req.param("botId")))) return c.json({ error: "NOT_FOUND" }, 404);
    const r = await sandboxFor(env, c.req.param("botId")).tree(userId, c.req.query("path"));
    c.header("Cache-Control", "no-store");
    return r.ok ? c.json({ entries: r.value }) : c.json({ error: "SANDBOX_UNAVAILABLE", message: r.error }, 409);
  })
  .get("/:botId/file", async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    if (!(await store.ownedBot(db, userId, c.req.param("botId")))) return c.json({ error: "NOT_FOUND" }, 404);
    const r = await sandboxFor(env, c.req.param("botId")).openFile(userId, c.req.query("path") ?? "");
    c.header("Cache-Control", "no-store");
    return r.ok ? c.json(r.value) : c.json({ error: "SANDBOX_UNAVAILABLE", message: r.error }, 409);
  })
  // The public URL of a server running in the sandbox on `port` (shown in the editor's preview).
  .get("/:botId/preview", async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    if (!(await store.ownedBot(db, userId, c.req.param("botId")))) return c.json({ error: "NOT_FOUND" }, 404);
    const port = Number(c.req.query("port"));
    if (!Number.isInteger(port) || port < 1 || port > 65535) return c.json({ error: "INVALID_INPUT", message: "Give a port between 1 and 65535." }, 400);
    const r = await sandboxFor(env, c.req.param("botId")).preview(userId, port);
    return r.ok ? c.json({ url: r.value }) : c.json({ error: "SANDBOX_UNAVAILABLE", message: r.error }, 409);
  })
  .put("/:botId/file", userLimit, validate("json", z.object({ path: z.string().min(1).max(500), content: z.string().max(2_000_000), baseHash: z.string().nullable() })), async (c) => {
    const { db, env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    if (!(await store.ownedBot(db, userId, c.req.param("botId")))) return c.json({ error: "NOT_FOUND" }, 404);
    const { path, content, baseHash } = c.req.valid("json");
    const r = await sandboxFor(env, c.req.param("botId")).saveFile(userId, path, content, baseHash);
    if (!r.ok) return c.json({ error: "SANDBOX_UNAVAILABLE", message: r.error }, 409);
    return "conflict" in r.value ? c.json({ error: "CONFLICT", message: "The file changed since you opened it.", hash: r.value.hash }, 409) : c.json(r.value);
  });

export default editor;
