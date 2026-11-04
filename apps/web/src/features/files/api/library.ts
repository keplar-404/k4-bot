import type { FileRef } from "@backend/modules/agent/parts";
import { redirectToSignIn } from "@/features/auth/auth-redirect";

export type { FileRef };

export const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

/** Same limit as the server (MAX_FILE_BYTES): checked here first so a big file fails before it uploads. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** The file's bytes, served by the API from storage (never from the computer). Images open inline. */
export const fileUrl = (id: string, download = false) =>
  `${BASE}/api/v1/files/${id}/content${download ? "?download=1" : ""}`;

/** Shown inline in the browser; the server serves only these as images (not SVG). */
export const isPreviewable = (mimeType: string) =>
  ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"].includes(
    mimeType,
  );

export const formatBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${Math.round(n / 1024)} KB`
      : `${(n / 1024 / 1024).toFixed(1)} MB`;

export interface LibraryFile extends FileRef {
  botId: string | null;
  botName: string | null;
  threadId: string | null;
  computerPath: string | null;
  prompt: string | null;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
  });
  if (res.status === 401) redirectToSignIn();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? "Something went wrong. Try again.");
  }
  return (await res.json()) as T;
}

export function listFiles(cursor?: string | null, botId?: string): Promise<{
  files: LibraryFile[];
  nextCursor: string | null;
}> {
  const q = new URLSearchParams({ limit: "40" });
  if (cursor) q.set("cursor", cursor);
  if (botId) q.set("botId", botId);
  return request(`/api/v1/files?${q.toString()}`);
}

export function deleteFile(id: string): Promise<{ ok: boolean }> {
  return request(`/api/v1/files/${id}`, { method: "DELETE" });
}
