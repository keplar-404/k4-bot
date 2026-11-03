import { BASE, post } from "./requests";

/** The screen saved when the computer last went to sleep, as an object URL (revoke it when done). */
export async function snapshotUrl(at: number): Promise<string | null> {
  const res = await fetch(`${BASE}/api/v1/computer/snapshot?at=${at}`, {
    credentials: "include",
  }).catch(() => null);
  if (!res?.ok) return null;
  return URL.createObjectURL(await res.blob());
}
export const mintSocketToken = () =>
  post<{ userId: string; token: string }>("/ws-token");

export function socketUrl(args: { userId: string; token: string }): string {
  const q = new URLSearchParams(args);
  return `${BASE.replace(/^http/, "ws")}/api/v1/computer/ws?${q.toString()}`;
}

/**
 * URL for the live view iframe. The token is part of the path (not the query), so noVNC's
 * own asset requests and WebSocket go through the same authenticated proxy.
 */
export async function viewerUrl(mode: "watch" | "control"): Promise<string> {
  const { path } = await post<{ path: string }>("/viewer", { mode });
  const q = new URLSearchParams({
    autoconnect: "true",
    resize: "scale",
    reconnect: "true",
    // noVNC waits 5 s before retrying a dropped or failed connection by default.
    reconnect_delay: "1000",
    view_only: String(mode === "watch"),
    path: `${path.slice(1)}websockify`,
  });
  return `${BASE}${path}vnc.html?${q.toString()}`;
}
