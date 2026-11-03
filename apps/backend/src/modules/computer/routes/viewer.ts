import { Hono } from "hono";
import { z } from "zod";
import { computerFor } from "../sandbox-backend";
import { getRequestContext } from "../../../shared/context";
import { signRelayToken, verifyRelayToken } from "../../../shared/relay-token";
import { validate } from "../../../shared/validate";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { ipLimit, userLimit } from "../../../middleware/rate-limit";
import { MODES, secretOf, STREAM_TOKEN_TTL_SECONDS } from "./novnc";

const viewer = new Hono<AuthGuardEnv>()
  // Credentials for the panel's status/activity socket.
  .post("/ws-token", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    return c.json({ userId, token: await signRelayToken({ secret: secretOf(env), userId, threadId: "computer:ws" }) });
  })

  // Path of the live view for the iframe. The token sits in the path, not the query, so noVNC's relative asset
  // requests and its WebSocket (path=...) inherit it without any change to noVNC.
  .post("/viewer", userLimit, validate("json", z.object({ mode: z.enum(MODES) })), async (c) => {
    const { env } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { mode } = c.req.valid("json");
    const token = await signRelayToken({
      secret: secretOf(env),
      userId,
      threadId: `computer:${mode}`,
      ttlSeconds: STREAM_TOKEN_TTL_SECONDS,
    });
    return c.json({ path: `/api/v1/computer/stream/${mode}/${userId}/${token}/`, expiresIn: STREAM_TOKEN_TTL_SECONDS });
  })

  .get("/ws", ipLimit, async (c) => {
    const { env } = getRequestContext(c);
    if (c.req.header("Upgrade") !== "websocket") return c.text("Expected a WebSocket", 426);
    // A browser always sends Origin on a WebSocket handshake: refuse other sites (cross-site WebSocket hijacking).
    const origin = c.req.header("Origin");
    if (env.WEB_ORIGIN && origin && origin !== env.WEB_ORIGIN) return c.text("Forbidden", 403);

    const url = new URL(c.req.url);
    const userId = url.searchParams.get("userId") ?? "";
    const token = url.searchParams.get("token") ?? "";
    if (!userId || !(await verifyRelayToken({ secret: secretOf(env), token, userId, threadId: "computer:ws" }))) {
      return c.text("Unauthorized", 401);
    }
    const res = await computerFor(env, userId).fetch(new Request("https://computer/ws", { headers: c.req.raw.headers }));
    // Rebuild the stub response: its headers are immutable and the CORS middleware writes to them.
    return new Response(res.webSocket ? null : res.body, res);
  });

export default viewer;
