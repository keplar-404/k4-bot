import { Hono } from "hono";
import { computerFor } from "../sandbox-backend";
import { getRequestContext } from "../../../shared/context";
import { verifyRelayToken } from "../../../shared/relay-token";
import type { AuthGuardEnv } from "../../../middleware/auth-guard";
import { injectIntoPage, type Mode, MODES, rest, retryPage, secretOf, secureViewerResponse, upstreamHeaders } from "./novnc";

/** `{host,token}` for the viewer, cached briefly in this isolate: a noVNC page is ~60 requests. */
const targets = new Map<string, { host: string; token: string; until: number }>();

const stream = new Hono<AuthGuardEnv>()
  // Authenticated reverse proxy to the VM's noVNC (HTTP and WebSocket). The VM is private: only this route,
  // holding E2B's per-sandbox traffic token, can reach it. `watch` is a view-only VNC server (read-only is
  // enforced on the VM, not in the browser); `control` exists only while the user holds the lease.
  .all("/stream/:mode/:userId/:token/*", async (c) => {
    const { env } = getRequestContext(c);
    const { mode, userId, token } = c.req.param();
    if (!(MODES as readonly string[]).includes(mode)) return c.text("Not found", 404);
    if (!(await verifyRelayToken({ secret: secretOf(env), token, userId, threadId: `computer:${mode}` }))) {
      return c.text("Unauthorized", 401);
    }
    const isSocket = c.req.header("Upgrade") === "websocket";
    if (isSocket) {
      const limited = await env.RL.limit({ key: `vnc:${userId}` }).catch(() => ({ success: true }));
      if (!limited.success) return c.text("Too many requests", 429);
    }

    const key = `${userId}:${mode}`;
    let target = targets.get(key);
    if (!target || target.until < Date.now() || isSocket) {
      const found = await computerFor(env, userId).viewerTarget(mode as Mode);
      if ("error" in found) {
        const status = found.error === "asleep" || found.error === "not_in_control" ? 409 : 502;
        if (rest(c.req.url, mode, userId, token) === "/vnc.html") {
          return c.html(retryPage(env.WEB_ORIGIN ?? "*"), status, {
            "cache-control": "no-store",
            "content-security-policy": `frame-ancestors ${env.WEB_ORIGIN ?? "'self'"}`,
          });
        }
        return c.text(found.error, status);
      }
      target = { ...found, until: Date.now() + 20_000 };
      targets.set(key, target);
    }

    const incoming = new URL(c.req.url);
    const path = rest(c.req.url, mode, userId, token);
    const upstream = await fetch(`https://${target.host}${path}${incoming.search}`, {
      method: c.req.method,
      headers: upstreamHeaders(target.token, (name) => c.req.header(name)),
      body: ["GET", "HEAD"].includes(c.req.method) ? undefined : c.req.raw.body,
    }).catch(() => null);
    if (!upstream || upstream.status === 502 || upstream.status === 503) {
      // The computer may have just gone to sleep: forget its address, and say "asleep" rather than a gateway error.
      targets.delete(key);
      const now = await computerFor(env, userId).viewerTarget(mode as Mode);
      return "error" in now && now.error === "asleep"
        ? c.text("asleep", 409)
        : c.text("The computer did not answer.", 502);
    }
    // Keeps the 101, the socket and the negotiated subprotocol (noVNC asks for "binary").
    if (isSocket) return new Response(null, upstream);

    // noVNC's own toolbar would show up inside our panel: the page is ours, so it hides it.
    const isPage = upstream.headers.get("content-type")?.includes("text/html") ?? false;
    const body = isPage ? injectIntoPage(await upstream.text(), env.WEB_ORIGIN ?? "*") : upstream.body;
    const out = new Response(body, upstream);
    if (isPage) out.headers.delete("content-length");
    return secureViewerResponse(out, env.WEB_ORIGIN, isPage, upstream.status);
  });

export default stream;
