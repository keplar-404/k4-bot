import { Hono } from "hono";
import { z } from "zod";
import { authGuard, type AuthGuardEnv } from "../../middleware/auth-guard";
import { userLimit } from "../../middleware/rate-limit";
import { getRequestContext } from "../../shared/context";
import { validate } from "../../shared/validate";
import { isKnownToolkit } from "./catalog-query";
import catalogRoutes from "./catalog-routes";
import { composioFor, TOOLKIT_SLUG } from "./client";
import { listConnections, ownConnection } from "./connections";
import { composioError } from "./errors";
import { connectCallback, userSession } from "./session";
import toolsRoutes from "./tools-routes";

const slug = z.string().regex(TOOLKIT_SLUG);
const authorizeBody = z.object({ toolkit: slug, returnTo: z.string().max(300).optional() });
/**
 * Composio connected apps (Platform: one session per user, our user id is Composio's user id, connections are
 * private to that user). Tokens never reach this Worker or the browser: Composio stores them and uses them when a
 * tool runs. The catalog comes from our own table (catalog-sync.ts), so browsing costs no Composio calls.
 */
const composioRoutes = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .route("/", toolsRoutes)
  .route("/", catalogRoutes)

  // The user's own connections (one Composio call). Limited: it is the only live call a page view makes.
  .get("/connections", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    try {
      c.header("Cache-Control", "no-store");
      return c.json({ items: await listConnections(composioFor(env), c.get("session").user.id) });
    } catch (error) {
      return composioError(c, error, "load your connections");
    }
  })

  // Start connecting an app: a Connect Link for this user only, returning to the page that asked (or Connect).
  .post("/authorize", userLimit, validate("json", authorizeBody), async (c) => {
    const { db, env } = getRequestContext(c);
    const { toolkit, returnTo } = c.req.valid("json");
    try {
      if (!(await isKnownToolkit(db, toolkit))) return c.json({ error: "NOT_FOUND", message: "Unknown app." }, 404);
      const session = await userSession(db, composioFor(env), c.get("session").user.id);
      const request = await session.authorize(toolkit, {
        callbackUrl: connectCallback(env.WEB_ORIGIN ?? env.BETTER_AUTH_URL, toolkit, returnTo),
      });
      if (!request.redirectUrl) {
        return c.json({ error: "NO_LINK", message: "This app could not start a connection." }, 502);
      }
      return c.json({ redirectUrl: request.redirectUrl });
    } catch (error) {
      return composioError(c, error, "start the connection");
    }
  })

  // Disconnect: only a connection this user owns (checked against their own list), then removed at Composio.
  .delete("/connections/:id", userLimit, validate("param", z.object({ id: z.string().min(1).max(100) })), async (c) => {
    const { env } = getRequestContext(c);
    const { id } = c.req.valid("param");
    try {
      const composio = composioFor(env);
      if (!(await ownConnection(composio, c.get("session").user.id, id))) {
        return c.json({ error: "NOT_FOUND", message: "Connection not found." }, 404);
      }
      await composio.connectedAccounts.delete(id);
      return c.json({ ok: true });
    } catch (error) {
      return composioError(c, error, "disconnect this app");
    }
  });

export default composioRoutes;
