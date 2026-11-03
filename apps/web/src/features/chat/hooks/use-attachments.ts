"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type Attachment,
  MAX_ATTACHMENTS,
  revoke,
  startUpload,
} from "./attachment";

export type { Attachment } from "./attachment";

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

  /** Drops one attachment and frees its preview. */
  const drop = useCallback((key: string) => {
    setItems((list) => {
      const gone = list.find((a) => a.key === key);
      if (gone) revoke(gone);
      return list.filter((a) => a.key !== key);
    });
  }, []);

  const update = useCallback(
    (key: string, patch: Partial<Attachment>) =>
      setItems((list) =>
        list.map((a) => (a.key === key ? { ...a, ...patch } : a)),
      ),
    [],
  );

  const add = useCallback(
    (files: File[]) => {
      const room = MAX_ATTACHMENTS - countRef.current;
      if (files.length > room) {
        toast.warning(
          `You can attach up to ${MAX_ATTACHMENTS} files to one message.`,
        );
      }
      const fresh = files
        .slice(0, Math.max(0, room))
        .map((file) =>
          startUpload(file, botId, aborts.current, { update, drop }),
        );
      countRef.current += fresh.length;
      setItems((current) => [...current, ...fresh]);
    },
    [botId, update, drop],
  );

  const remove = useCallback(
    (key: string) => {
      aborts.current.get(key)?.abort();
      drop(key);
    },
    [drop],
  );

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
