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
import type { Connection } from "../api";

export type PendingDisconnect = {
  connection: Connection;
  appName: string;
} | null;

/** Confirms disconnecting an account: bots and workflows that use it stop working with that app. */
export function DisconnectDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingDisconnect;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const account = pending?.connection.account;
  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {pending?.appName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {account
              ? `${account} will be removed. `
              : "This account will be removed. "}
            Workflows and bots that use it stop working with {pending?.appName}{" "}
            until you connect it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
