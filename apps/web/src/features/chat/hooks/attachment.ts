import { toast } from "sonner";
import { type FileRef, isPreviewable, uploadFile } from "@/features/files/api";

export interface Attachment {
  key: string;
  name: string;
  /** 0..1 while uploading. */
  progress: number;
  /** A local preview of an image (object URL), shown before the upload finishes. */
  preview?: string;
  /** Set once the server stored it. */
  file?: FileRef;
}

/** Files attached in the composer per message. */
export const MAX_ATTACHMENTS = 10;

export const revoke = (a: Attachment) => {
  if (a.preview) URL.revokeObjectURL(a.preview);
};

/** Starts uploading one picked file; its progress, result or failure is reported through `on`. */
export function startUpload(
  file: File,
  botId: string,
  aborts: Map<string, AbortController>,
  on: {
    update: (key: string, patch: Partial<Attachment>) => void;
    drop: (key: string) => void;
  },
): Attachment {
  const key = crypto.randomUUID();
  const abort = new AbortController();
  aborts.set(key, abort);
  uploadFile(
    file,
    botId,
    (progress) => on.update(key, { progress }),
    abort.signal,
  )
    .then((stored) => on.update(key, { progress: 1, file: stored }))
    .catch((error: Error) => {
      if (error.name !== "AbortError") toast.error(error.message);
      on.drop(key);
    })
    .finally(() => aborts.delete(key));
  return {
    key,
    name: file.name,
    progress: 0,
    preview: isPreviewable(file.type) ? URL.createObjectURL(file) : undefined,
  };
}
