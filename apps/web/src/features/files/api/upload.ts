import { redirectToSignIn } from "@/features/auth/auth-redirect";
import { BASE, type FileRef, formatBytes, MAX_FILE_BYTES } from "./library";

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
