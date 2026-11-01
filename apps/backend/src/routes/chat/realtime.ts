import { Hono } from "hono";
import { getRequestContext } from "../../lib/context";
import { getOwnedThread } from "../../lib/threads";
import { signRelayToken } from "../../lib/relay-token";
import { userLimit } from "../../middleware/rate-limit";
import type { AuthGuardEnv } from "../../middleware/auth-guard";

const realtime = new Hono<AuthGuardEnv>()
  // The relay Durable Object is the only place the signed token is verified.
  .get("/threads/:id/ws", async (c) => {
    const { env } = getRequestContext(c);
    const threadId = c.req.param("id");
    const incoming = new URL(c.req.url);
    const target = new URL("https://relay/connect");
    target.searchParams.set("threadId", threadId);
    for (const key of ["userId", "token", "lastSeq"]) {
      const value = incoming.searchParams.get(key);
      if (value !== null) target.searchParams.set(key, value);
    }
    const stub = env.CHAT_RELAY.get(env.CHAT_RELAY.idFromName(threadId));
    const res = await stub.fetch(new Request(target, { headers: c.req.raw.headers }));
    // A stub response has immutable headers, and the CORS/secure-headers
    // middleware writes to them. Rebuild it (keeping the socket on a 101).
    return new Response(res.webSocket ? null : res.body, res);
  })

  // Short-lived socket credential. Only for a thread the caller owns; otherwise
  // any signed-in user could subscribe to another user's stream.
  .post("/threads/:id/ws-token", userLimit, async (c) => {
    const { env, db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const threadId = c.req.param("id");
    if (!(await getOwnedThread(db, threadId, userId))) {
      return c.json({ error: "NOT_FOUND" }, 404);
    }
    const secret = env.WS_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET;
    return c.json({ token: await signRelayToken({ secret, userId, threadId }), threadId, userId });
  });

export default realtime;
