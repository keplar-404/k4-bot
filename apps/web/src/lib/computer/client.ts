import type { ActivityEvent, ComputerStatus } from "@backend/computer/types";
import { ChatHttpError } from "@/lib/chat/client";
import { mapHttpError, networkError } from "@/lib/chat/protocol";

export type { ActivityEvent, ComputerStatus };

export const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/computer${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ChatHttpError(networkError());
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ChatHttpError(
      mapHttpError(res.status, body, res.headers.get("retry-after")),
    );
  }
  return body as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const getStatus = () => request<ComputerStatus>("");
/** The only call that can start billing: it wakes (or creates) the user's computer. */
export const wake = () => post<ComputerStatus>("/wake");
export const pause = () => post<ComputerStatus>("/pause");
export const takeControl = () =>
  post<{ ok: boolean; message?: string }>("/control/take");
export const keepControl = () => post<{ held: boolean }>("/control/keep");
export const releaseControl = () => post<{ ok: boolean }>("/control/release");

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
    view_only: String(mode === "watch"),
    path: `${path.slice(1)}websockify`,
  });
  return `${BASE}${path}vnc.html?${q.toString()}`;
}
