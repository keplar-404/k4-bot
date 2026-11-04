"use client";

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
import type { SandboxRow } from "./api";

/** Confirms deleting a sandbox, naming the bot and what it was for: everything in it is lost. */
export function DeleteSandboxDialog({
  row,
  onCancel,
  onConfirm,
}: {
  row: SandboxRow | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={row !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {row?.botName}&apos;s sandbox?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Used for “{row?.purpose}”, last used{" "}
            {row ? new Date(row.lastUsedAt).toLocaleString() : ""}. Every file
            in it is deleted and cannot be recovered. The bot can create a new,
            empty one later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete sandbox
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
