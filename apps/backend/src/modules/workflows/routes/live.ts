import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../config/env";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { userLimit } from "../../../middleware/rate-limit";
import { getRequestContext } from "../../../shared/context";
import { signRelayToken } from "../../../shared/relay-token";
import { validate } from "../../../shared/validate";
import { liveRelay } from "../live/publish";
import { liveScope } from "../live/token";
import { getWorkflow } from "../store/workflows";

const idParam = z.object({ id: z.uuid() });

/**
 * GET /workflows/:id/live: the builder's WebSocket. Browsers cannot send headers on a WebSocket and the web app is
 * another origin, so the socket carries a short-lived signed token instead of the session; the relay checks it.
 * Mounted before the session guard for that reason.
 */
export const liveSocket = new Hono<{ Bindings: Env }>().get("/:id/live", validate("param", idParam), async (c) => {
  const { env } = getRequestContext(c);
  const { id } = c.req.valid("param");
  const incoming = new URL(c.req.url);

  const target = new URL("https://relay/connect");
  target.searchParams.set("workflowId", id);
  for (const key of ["userId", "token"]) {
    target.searchParams.set(key, incoming.searchParams.get(key) ?? "");
  }

  const res = await liveRelay(env, id).fetch(new Request(target, { headers: c.req.raw.headers }));
  // A stub response has immutable headers, and the CORS/secure-headers middleware writes to them.
  return new Response(res.webSocket ? null : res.body, res);
});

/** POST /workflows/:id/live-token: the token for the socket above, only for the workflow's owner. */
export const liveToken = new Hono<AuthGuardEnv>().post(
  "/:id/live-token",
  userLimit,
  validate("param", idParam),
  async (c) => {
    const { env, db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { id } = c.req.valid("param");
    if (!(await getWorkflow(db, userId, id))) {
      return c.json({ error: "NOT_FOUND", message: "Workflow not found." }, 404);
    }
    const token = await signRelayToken({
      secret: env.WS_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET,
      userId,
      threadId: liveScope(id),
    });
    return c.json({ token, userId });
  },
);
