import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { BASE } from "@/features/files/api/library";

/** One bot's code sandbox, as GET /api/v1/sandbox lists it. */
export interface SandboxRow {
  botId: string;
  botName: string;
  status: "creating" | "running" | "paused" | "error";
  purpose: string;
  createdAt: string;
  lastUsedAt: string;
  usageDay: string | null;
  usageSeconds: number;
}

export interface SandboxList {
  sandboxes: SandboxRow[];
  limits: {
    maxPerUser: number;
    maxMinutesPerDay: number;
    secondsToday: number;
  };
}

async function request<T>(path: string, method = "GET"): Promise<T> {
  const res = await fetch(`${BASE}/api/v1/sandbox${path}`, {
    method,
    credentials: "include",
  });
  if (res.status === 401) redirectToSignIn();
  const body = (await res.json().catch(() => null)) as {
    message?: string;
  } | null;
  if (!res.ok)
    throw new Error(body?.message ?? "Something went wrong. Try again.");
  return body as T;
}

export const listSandboxes = () => request<SandboxList>("");
export const startSandbox = (botId: string) =>
  request<{ ok: true }>(`/${botId}/start`, "POST");
export const pauseSandbox = (botId: string) =>
  request<{ ok: true }>(`/${botId}/pause`, "POST");
/** Deletes the sandbox in E2B and all its files. */
export const deleteSandbox = (botId: string) =>
  request<{ ok: true }>(`/${botId}`, "DELETE");
