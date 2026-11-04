import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { BASE } from "@/features/files/api/library";

export type TreeEntry = { path: string; dir: boolean };
export type OpenFile = { path: string; content: string; hash: string };

/** A failed call with the server's code (CONFLICT, NO_SANDBOX, …) so the editor can react to each. */
export class SandboxApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hash?: string,
  ) {
    super(message);
  }
}

async function request<T>(
  botId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}/api/v1/sandbox/${botId}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json" },
  });
  if (res.status === 401) redirectToSignIn();
  const body = (await res.json().catch(() => null)) as {
    error?: string;
    message?: string;
    hash?: string;
  } | null;
  if (!res.ok)
    throw new SandboxApiError(
      body?.message ?? "The sandbox did not answer. Try again.",
      body?.error ?? "ERROR",
      body?.hash,
    );
  return body as T;
}

/** Wakes the sandbox and returns the token of the editor's live socket. */
export const openEditor = (botId: string) =>
  request<{ token: string; userId: string }>(botId, "/open", {
    method: "POST",
  });
export const listTree = (botId: string) =>
  request<{ entries: TreeEntry[] }>(botId, "/tree").then((r) => r.entries);
export const readFile = (botId: string, path: string) =>
  request<OpenFile>(botId, `/file?path=${encodeURIComponent(path)}`);
export const previewUrl = (botId: string, port: number) =>
  request<{ url: string }>(botId, `/preview?port=${port}`).then((r) => r.url);

/** Saves over `baseHash` only; a newer version on the sandbox raises SandboxApiError code CONFLICT. */
export const saveFile = (
  botId: string,
  path: string,
  content: string,
  baseHash: string | null,
) =>
  request<{ hash: string }>(botId, "/file", {
    method: "PUT",
    body: JSON.stringify({ path, content, baseHash }),
  }).then((r) => r.hash);

export const socketUrl = (botId: string, token: string, userId: string) =>
  `${BASE.replace(/^http/, "ws")}/api/v1/sandbox/${botId}/ws?${new URLSearchParams({ token, userId })}`;
