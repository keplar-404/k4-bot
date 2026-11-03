"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Bot } from "@/features/bots/api";

/**
 * Deleting is irreversible (chats and the bot's files on the computer go too), so it is confirmed first:
 * `handleDelete` asks, `confirmDelete` deletes and leaves the bot's page if it was open.
 */
export function useDeleteBot(
  bots: Bot[],
  deleteBot: (id: string) => Promise<void>,
) {
  const router = useRouter();
  const pathname = usePathname();
  const [confirming, setConfirming] = useState<Bot | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(
    (id: string) => setConfirming(bots.find((b) => b.id === id) ?? null),
    [bots],
  );

  const confirmDelete = useCallback(async () => {
    if (!confirming) return;
    setDeleting(true);
    try {
      await deleteBot(confirming.id);
      toast.success(`${confirming.name} was deleted.`);
      if (pathname === `/dashboard/bot/${confirming.id}`) {
        router.replace("/dashboard");
      }
      setConfirming(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete bot.");
    } finally {
      setDeleting(false);
    }
  }, [confirming, deleteBot, pathname, router]);

  return { confirming, setConfirming, deleting, handleDelete, confirmDelete };
}
