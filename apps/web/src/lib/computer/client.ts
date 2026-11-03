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
/** Sleeps the computer now; its open apps and files are saved. */
export const pause = () => post<ComputerStatus>("/pause");
/** The session is ending: the bots are told to finish and summarise, then it sleeps. */
export const wrapUp = () => post<ComputerStatus>("/session/wrap");

/** The screen saved when the computer last went to sleep, as an object URL (revoke it when done). */
export async function snapshotUrl(at: number): Promise<string | null> {
  const res = await fetch(`${BASE}/api/v1/computer/snapshot?at=${at}`, {
    credentials: "include",
  }).catch(() => null);
  if (!res?.ok) return null;
  return URL.createObjectURL(await res.blob());
}
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
    // noVNC waits 5 s before retrying a dropped or failed connection by default.
    reconnect_delay: "1000",
    view_only: String(mode === "watch"),
    path: `${path.slice(1)}websockify`,
  });
  return `${BASE}${path}vnc.html?${q.toString()}`;
}
