import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { bot } from "../../../db/schema";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { getRequestContext } from "../../../shared/context";
import { validate } from "../../../shared/validate";
import { composioFor } from "../../composio/client";
import { ownConnection } from "../../composio/connections";
import { computerFor } from "../sandbox-backend";

const body = z.object({
  botId: z.string().min(1).max(64),
  accountId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  url: z.string().url().max(2048),
});

/**
 * POST /computer/app-login: opens an app's website in a bot's browser, in the profile of one connected account, so
 * the user can sign in there once (take control on the computer page). The bot and the account must be the user's;
 * the computer is woken if needed (that uses computer time, which the user asked for by clicking).
 */
const appLogin = new Hono<AuthGuardEnv>().post("/app-login", userLimit, validate("json", body), async (c) => {
  const { db, env } = getRequestContext(c);
  const userId = c.get("session").user.id;
  const { botId, accountId, url } = c.req.valid("json");
  const [owned] = await db.select({ id: bot.id }).from(bot).where(and(eq(bot.id, botId), eq(bot.userId, userId))).limit(1);
  if (!owned) return c.json({ error: "NOT_FOUND", message: "Bot not found." }, 404);
  const connection = await ownConnection(composioFor(env), userId, accountId).catch(() => null);
  if (!connection) return c.json({ error: "NOT_FOUND", message: "Connection not found." }, 404);
  const stub = computerFor(env, userId);
  try {
    await stub.ensure();
  } catch (error) {
    return c.json({ error: "COMPUTER_UNAVAILABLE", message: error instanceof Error ? error.message : "The computer is unavailable." }, 409);
  }
  const result = await stub.openAppLogin(botId, url, { toolkit: connection.toolkit, accountId });
  if (!result.ok) return c.json({ error: "NOT_OPENED", message: result.text }, 422);
  return c.json({ ok: true });
});

export default appLogin;
