import type { Env } from "../../../config/env";

export const secretOf = (env: Env) => env.WS_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET;

/**
 * The live view is loaded in an iframe and over WebSocket, where no Authorization header can be sent.
 * One token outlives a whole session (COMPUTER_SESSION_MINUTES + wrap-up), so the viewer never has to
 * reload mid-session; noVNC's automatic reconnect reuses it after a network blip.
 */
export const STREAM_TOKEN_TTL_SECONDS = 30 * 60;
export const MODES = ["watch", "control"] as const;
export type Mode = (typeof MODES)[number];

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

/** What noVNC's own page gets added: our styles and the state reporter. */
export const injectIntoPage = (html: string, origin: string) =>
  html.replace("</head>", `<style>${HIDE_NOVNC_CHROME}</style><script>${reportVncState(origin)}</script></head>`);

/**
 * The viewer page while the computer cannot be reached: instead of raw error text inside the panel, a blank page
 * that keeps the panel's "connecting" state and tries again (the screen servers may still be starting).
 */
export const retryPage = (origin: string) =>
  `<!doctype html><html><head><style>html,body{background:#0b0b0c}</style><script>${reportVncState(origin)};setTimeout(()=>location.reload(),3000)</script></head></html>`;

/** The path inside the VM's noVNC server, after the token. */
export const rest = (url: string, mode: string, userId: string, token: string) =>
  new URL(url).pathname.slice(`/api/v1/computer/stream/${mode}/${userId}/${token}`.length) || "/";

/** Request headers the VM needs: never the user's cookies or the Authorization header. */
export function upstreamHeaders(trafficToken: string, header: (name: string) => string | undefined): Headers {
  const headers = new Headers({ "e2b-traffic-access-token": trafficToken });
  for (const name of ["accept", "accept-language", "range", "upgrade", "connection", "sec-websocket-key", "sec-websocket-version", "sec-websocket-protocol", "sec-websocket-extensions"]) {
    const value = header(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

/** The page is meant to be framed, but only by our own web app; and the token in the URL must not leak. */
export function secureViewerResponse(out: Response, origin: string | undefined, isPage: boolean, status: number) {
  out.headers.delete("x-frame-options");
  out.headers.set("content-security-policy", `frame-ancestors ${origin ?? "'self'"}`);
  out.headers.set("cross-origin-resource-policy", "cross-origin");
  out.headers.set("referrer-policy", "no-referrer");
  out.headers.set("x-content-type-options", "nosniff");
  // noVNC's scripts and styles are fixed for the session and their URL carries the session's token:
  // the browser may keep them, so a page reload does not send ~60 requests through the Worker again.
  out.headers.set("cache-control", isPage || status !== 200 ? "no-store" : "private, max-age=1800");
  return out;
}
