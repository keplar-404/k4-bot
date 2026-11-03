"use client";

import { Loader2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Bot } from "@/features/bots/api";

/** Deleting is irreversible (chats and the bot's files on the computer go too), so it is confirmed first. */
export function DeleteBotDialog({
  bot,
  deleting,
  onCancel,
  onConfirm,
}: {
  bot: Bot | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={bot !== null}
      onOpenChange={(open) => !open && !deleting && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {bot?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the bot, all of its chats, and its folder
            and files on your computer. Anything it is doing now stops. Your
            other bots and their files are not affected. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting && <Loader2Icon className="animate-spin" />}
            Delete bot
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
