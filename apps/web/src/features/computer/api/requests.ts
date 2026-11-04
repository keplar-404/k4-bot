import type {
  ActivityEvent,
  ComputerSettings,
  ComputerSettingsInput,
  ComputerStatus,
  WorkingBot,
} from "@backend/modules/computer/types";
import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { ChatHttpError } from "@/features/chat/lib/client";
import { mapHttpError, networkError } from "@/features/chat/lib/protocol";

export type {
  ActivityEvent,
  ComputerSettings,
  ComputerSettingsInput,
  ComputerStatus,
  WorkingBot,
};

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
    if (res.status === 401) redirectToSignIn();
    throw new ChatHttpError(
      mapHttpError(res.status, body, res.headers.get("retry-after")),
    );
  }
  return body as T;
}

export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const getStatus = () => request<ComputerStatus>("");
/** The only call that can start billing: it wakes (or creates) the user's computer. */
export const wake = () => post<ComputerStatus>("/wake");
export type CloseResult =
  | { closed: true; status: ComputerStatus }
  | { closed: false; working: WorkingBot[] };

/**
 * Sleeps the computer; its open apps and files are saved. While bots are using it the server refuses
 * (409 + who) unless `force` is set, so the page can ask first and a stale screen can never kill their work.
 */
export const closeComputer = (force: boolean) => forceable("/pause", force);

/**
 * Wipes the computer to a brand-new one: every bot's files and open apps are gone. Same rule as closing:
 * while bots are working the server refuses (409 + who) unless `force`, and forced it stops their runs.
 */
export const resetComputer = (force: boolean) => forceable("/reset", force);

export const getSettings = () => request<ComputerSettings>("/settings");
export const saveSettings = (input: ComputerSettingsInput) =>
  request<ComputerSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });

/** A POST that bots at work can refuse: 409 BOTS_WORKING returns who, so the page can ask before forcing. */
async function forceable(path: string, force: boolean): Promise<CloseResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/computer${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force }),
    });
  } catch {
    throw new ChatHttpError(networkError());
  }
  const body = (await res.json().catch(() => null)) as {
    error?: string;
    working?: WorkingBot[];
  } | null;
  if (res.status === 409 && body?.error === "BOTS_WORKING")
    return { closed: false, working: body.working ?? [] };
  if (!res.ok) {
    if (res.status === 401) redirectToSignIn();
    throw new ChatHttpError(
      mapHttpError(res.status, body, res.headers.get("retry-after")),
    );
  }
  return { closed: true, status: body as ComputerStatus };
}
/** The session is ending: the bots are told to finish and summarise, then it sleeps. */
export const wrapUp = () => post<ComputerStatus>("/session/wrap");

export const takeControl = () =>
  post<{ ok: boolean; message?: string }>("/control/take");
export const keepControl = () => post<{ held: boolean }>("/control/keep");
export const releaseControl = () => post<{ ok: boolean }>("/control/release");
