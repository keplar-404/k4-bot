"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { deleteGroup, type Group } from "./api";

/** Deleting a group removes its chat for good (the bots stay), so it is confirmed first. */
export function DeleteGroupDialog({
  group,
  onClose,
  onDeleted,
}: {
  group: Group | null;
  onClose: () => void;
  onDeleted: (g: Group) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  async function confirm() {
    if (!group) return;
    setDeleting(true);
    try {
      await deleteGroup(group.id);
      onDeleted(group);
      onClose();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not delete the group.",
      );
    } finally {
      setDeleting(false);
    }
  }
  return (
    <AlertDialog
      open={group !== null}
      onOpenChange={(open) => !open && !deleting && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {group?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The group and its chat are deleted. Its bots, their own chats and
            their files stay. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={() => void confirm()}
          >
            {deleting && <Loader2Icon className="animate-spin" />}
            Delete group
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
