import type { FileRef } from "@backend/agent/parts";
import { redirectToSignIn } from "@/lib/auth-redirect";

export type { FileRef };

const BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787";

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

/**
 * Uploads one file. XMLHttpRequest rather than fetch: it reports upload progress.
 * Resolves with the stored file, or rejects with a message for the user.
 */
export function uploadFile(
  file: File,
  botId: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<FileRef> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_BYTES) {
      reject(
        new Error(
          `"${file.name}" is ${formatBytes(file.size)}. Files can be at most ${formatBytes(MAX_FILE_BYTES)}.`,
        ),
      );
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/v1/files`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: { file?: FileRef; message?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // not JSON: handled below
      }
      if (xhr.status === 401) redirectToSignIn();
      if (xhr.status === 201 && body?.file) resolve(body.file);
      else
        reject(
          new Error(
            body?.message ?? `Couldn't upload "${file.name}". Try again.`,
          ),
        );
    };
    xhr.onerror = () =>
      reject(new Error(`Couldn't upload "${file.name}": connection lost.`));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    form.append("file", file);
    form.append("botId", botId);
    xhr.send(form);
  });
}

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

export function listFiles(cursor?: string | null): Promise<{
  files: LibraryFile[];
  nextCursor: string | null;
}> {
  const q = new URLSearchParams({ limit: "40" });
  if (cursor) q.set("cursor", cursor);
  return request(`/api/v1/files?${q.toString()}`);
}

export function deleteFile(id: string): Promise<{ ok: boolean }> {
  return request(`/api/v1/files/${id}`, { method: "DELETE" });
}
