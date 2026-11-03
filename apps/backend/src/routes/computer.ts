import { Hono } from "hono";
import { z } from "zod";
import { computerFor } from "../computer/sandbox-backend";
import { getRequestContext } from "../lib/context";
import type { Env } from "../lib/env";
import { signRelayToken, verifyRelayToken } from "../lib/relay-token";
import { validate } from "../lib/validate";
import { authGuard, type AuthGuardEnv } from "../middleware/auth-guard";
import { ipLimit, userLimit } from "../middleware/rate-limit";

/**
 * The user's computer, from the browser's side.
 *
 * Nothing here talks to E2B directly: every call goes to the user's own
 * UserComputer Durable Object (one per user, named by user id), so a user can
 * only ever reach their own computer.
 */

const secretOf = (env: Env) => env.WS_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET;

/**
 * The live view is loaded in an iframe and over WebSocket, where no Authorization header can be sent.
 * One token outlives a whole session (COMPUTER_SESSION_MINUTES + wrap-up), so the viewer never has to
 * reload mid-session; noVNC's automatic reconnect reuses it after a network blip.
 */
const STREAM_TOKEN_TTL_SECONDS = 30 * 60;
const MODES = ["watch", "control"] as const;
type Mode = (typeof MODES)[number];

/**
 * noVNC (1.7) paints its own toolbar, status line ("Failed to connect to server"), connect dialog and
 * "Connecting..." / "Reconnecting..." overlay. Inside our panel those read as errors and flicker, so they
 * are hidden, and the page instead tells the panel its connection state (noVNC's own `noVNC_connected` /
 * `noVNC_reconnecting` classes on <html>), so the panel shows one loading state of its own until it is live.
 */
const HIDE_NOVNC_CHROME =
  "#noVNC_control_bar_anchor,#noVNC_status,#noVNC_connect_dlg,#noVNC_transition,#noVNC_fallback_error{display:none!important}html,body{background:#0b0b0c}";
const reportVncState = (origin: string) =>
  `(()=>{const h=document.documentElement,post=()=>parent.postMessage({source:"k4-vnc",state:h.classList.contains("noVNC_connected")?"connected":h.classList.contains("noVNC_reconnecting")?"reconnecting":"connecting"},${JSON.stringify(origin)});new MutationObserver(post).observe(h,{attributes:true,attributeFilter:["class"]});post()})()`;

/** The path inside the VM's noVNC server, after the token. */
const rest = (url: string, mode: string, userId: string, token: string) =>
  new URL(url).pathname.slice(`/api/v1/computer/stream/${mode}/${userId}/${token}`.length) || "/";

/** `{host,token}` for the viewer, cached briefly in this isolate: a noVNC page is ~60 requests. */
const targets = new Map<string, { host: string; token: string; until: number }>();

const message = (error: unknown) => (error instanceof Error ? error.message : "The computer is unavailable.");

const computer = new Hono<AuthGuardEnv>()
  .use("*", async (c, next) => {
    // The panel socket and the live-view proxy carry their own signed, short-lived tokens.
    const path = c.req.path;
    if (path.endsWith("/computer/ws") || path.includes("/computer/stream/")) return next();
    return authGuard(c, next);
  })

  .get("/", async (c) => {
    const { env } = getRequestContext(c);
    return c.json(await computerFor(env, c.get("session").user.id).status());
  })

  // Wakes (or creates) the computer. Quota is checked inside; this is the only call that can start billing.
  .post("/wake", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    const stub = computerFor(env, c.get("session").user.id);
    try {
      await stub.ensure();
    } catch (error) {
      return c.json({ error: "COMPUTER_UNAVAILABLE", message: message(error) }, 409);
    }
    return c.json(await stub.status());
  })

  // Sleeps the computer. While bots are working it does nothing unless `force` is set, and answers 409 with
  // who is working so the page can ask first; forced, those bots are told it was shut down and stop.
  .post("/pause", userLimit, validate("json", z.object({ force: z.boolean().optional() }).default({})), async (c) => {
    const { env } = getRequestContext(c);
    const stub = computerFor(env, c.get("session").user.id);
    const result = await stub.close({ reason: "Paused by you. Your work is saved.", cause: "user", force: c.req.valid("json").force === true });
    if (!result.closed) return c.json({ error: "BOTS_WORKING", message: "Bots are using the computer.", working: result.working }, 409);
    return c.json(await stub.status());
  })

  // The session is ending: tell the bots to finish and summarise; the computer sleeps a little later.
  .post("/session/wrap", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    const stub = computerFor(env, c.get("session").user.id);
    await stub.wrapUp();
    return c.json(await stub.status());
  })

  // The screen saved when the computer last went to sleep. Read from Durable Object storage: no E2B call.
  .get("/snapshot", async (c) => {
    const { env } = getRequestContext(c);
    const shot = await computerFor(env, c.get("session").user.id).snapshot();
    if (!shot) return c.body(null, 404);
    return c.body(shot.png as Uint8Array<ArrayBuffer>, 200, {
      "content-type": "image/png",
      // The client asks with ?at=<snapshotAt>, so a new screen is a new URL.
      "cache-control": "private, max-age=86400",
    });
  })

  // The user takes the mouse and keyboard; bots are told to wait. `keep` is the heartbeat while in control.
  .post("/control/take", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    try {
      const result = await computerFor(env, c.get("session").user.id).takeControl();
      return c.json(result, result.ok ? 200 : 409);
    } catch (error) {
      return c.json({ error: "COMPUTER_UNAVAILABLE", message: message(error) }, 409);
    }
  })
  .post("/control/keep", async (c) => {
    const { env } = getRequestContext(c);
    return c.json({ held: await computerFor(env, c.get("session").user.id).keepControl() });
  })
  .post("/control/release", userLimit, async (c) => {
    const { env } = getRequestContext(c);
    await computerFor(env, c.get("session").user.id).releaseControl();
    return c.json({ ok: true });
  })

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
  })

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
        // The viewer page itself: instead of raw error text inside the panel, a blank page that keeps the
        // panel's "connecting" state and tries again (the screen servers may still be starting).
        if (rest(c.req.url, mode, userId, token) === "/vnc.html") {
          return c.html(
            `<!doctype html><html><head><style>html,body{background:#0b0b0c}</style><script>${reportVncState(env.WEB_ORIGIN ?? "*")};setTimeout(()=>location.reload(),3000)</script></head></html>`,
            status,
            { "cache-control": "no-store", "content-security-policy": `frame-ancestors ${env.WEB_ORIGIN ?? "'self'"}` },
          );
        }
        return c.text(found.error, status);
      }
      target = { ...found, until: Date.now() + 20_000 };
      targets.set(key, target);
    }

    const incoming = new URL(c.req.url);
    const path = rest(c.req.url, mode, userId, token);

    // Only what the VM needs: never forward the user's cookies or the Authorization header.
    const headers = new Headers({ "e2b-traffic-access-token": target.token });
    for (const name of ["accept", "accept-language", "range", "upgrade", "connection", "sec-websocket-key", "sec-websocket-version", "sec-websocket-protocol", "sec-websocket-extensions"]) {
      const value = c.req.header(name);
      if (value) headers.set(name, value);
    }
    const upstream = await fetch(`https://${target.host}${path}${incoming.search}`, {
      method: c.req.method,
      headers,
      body: ["GET", "HEAD"].includes(c.req.method) ? undefined : c.req.raw.body,
    }).catch(() => null);
    if (!upstream) return c.text("The computer did not answer.", 502);
    // Keeps the 101, the socket and the negotiated subprotocol (noVNC asks for "binary").
    if (isSocket) return new Response(null, upstream);

    // noVNC's own toolbar would show up inside our panel: the page is ours, so it hides it.
    const isPage = upstream.headers.get("content-type")?.includes("text/html");
    const body = isPage
      ? (await upstream.text()).replace(
          "</head>",
          `<style>${HIDE_NOVNC_CHROME}</style><script>${reportVncState(env.WEB_ORIGIN ?? "*")}</script></head>`,
        )
      : upstream.body;
    const out = new Response(body, upstream);
    if (isPage) out.headers.delete("content-length");
    // The page is meant to be framed, but only by our own web app; and the token in the URL must not leak.
    out.headers.delete("x-frame-options");
    out.headers.set("content-security-policy", `frame-ancestors ${env.WEB_ORIGIN ?? "'self'"}`);
    out.headers.set("cross-origin-resource-policy", "cross-origin");
    out.headers.set("referrer-policy", "no-referrer");
    out.headers.set("x-content-type-options", "nosniff");
    // noVNC's scripts and styles are fixed for the session and their URL carries the session's token:
    // the browser may keep them, so a page reload does not send ~60 requests through the Worker again.
    out.headers.set("cache-control", isPage || upstream.status !== 200 ? "no-store" : "private, max-age=1800");
    return out;
  });

export default computer;
