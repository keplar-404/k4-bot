"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type FileRef, isPreviewable, uploadFile } from "@/lib/files";

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
const MAX_ATTACHMENTS = 10;

const revoke = (a: Attachment) => {
  if (a.preview) URL.revokeObjectURL(a.preview);
};

/**
 * The composer's attachments. A file uploads as soon as it is picked, so sending is instant; the message
 * then carries only the stored files' ids. A failed upload is dropped with a toast saying why.
 */
export function useAttachments(botId: string) {
  const [items, setItems] = useState<Attachment[]>([]);
  const aborts = useRef(new Map<string, AbortController>());

  // The upload starts here, outside any state updater (React may run an updater twice).
  const countRef = useRef(0);
  countRef.current = items.length;

  const add = useCallback(
    (files: File[]) => {
      const room = MAX_ATTACHMENTS - countRef.current;
      if (files.length > room) {
        toast.warning(
          `You can attach up to ${MAX_ATTACHMENTS} files to one message.`,
        );
      }
      const fresh = files.slice(0, Math.max(0, room)).map((file) => {
        const key = crypto.randomUUID();
        const abort = new AbortController();
        aborts.current.set(key, abort);
        uploadFile(
          file,
          botId,
          (progress) =>
            setItems((list) =>
              list.map((a) => (a.key === key ? { ...a, progress } : a)),
            ),
          abort.signal,
        )
          .then((stored) =>
            setItems((list) =>
              list.map((a) =>
                a.key === key ? { ...a, progress: 1, file: stored } : a,
              ),
            ),
          )
          .catch((error: Error) => {
            if (error.name !== "AbortError") toast.error(error.message);
            setItems((list) => {
              const gone = list.find((a) => a.key === key);
              if (gone) revoke(gone);
              return list.filter((a) => a.key !== key);
            });
          })
          .finally(() => aborts.current.delete(key));
        return {
          key,
          name: file.name,
          progress: 0,
          preview: isPreviewable(file.type)
            ? URL.createObjectURL(file)
            : undefined,
        } satisfies Attachment;
      });
      countRef.current += fresh.length;
      setItems((current) => [...current, ...fresh]);
    },
    [botId],
  );

  const remove = useCallback((key: string) => {
    aborts.current.get(key)?.abort();
    setItems((list) => {
      const gone = list.find((a) => a.key === key);
      if (gone) revoke(gone);
      return list.filter((a) => a.key !== key);
    });
  }, []);

  /** After sending: the previews are no longer needed (the chat shows the stored files). */
  const clear = useCallback(() => {
    setItems((list) => {
      for (const a of list) revoke(a);
      return [];
    });
  }, []);

  // Switching bots or leaving the page: stop uploads and free the previews.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on bot change only
  useEffect(
    () => () => {
      for (const abort of aborts.current.values()) abort.abort();
      aborts.current.clear();
      setItems((list) => {
        for (const a of list) revoke(a);
        return [];
      });
    },
    [botId],
  );

  return {
    items,
    add,
    remove,
    clear,
    uploading: items.some((a) => !a.file),
    files: items.flatMap((a) => (a.file ? [a.file] : [])),
  };
}
