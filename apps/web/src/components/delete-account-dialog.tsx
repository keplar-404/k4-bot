"use client";

import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const CONFIRM_WORD = "DELETE";

/**
 * Account deletion, in two steps: this dialog (typed confirmation, so it is never a misclick), then a
 * link sent to the account's email (Better Auth's `sendDeleteAccountVerification`), which does the deletion.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}) {
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (sending) return;
    onOpenChange(next);
    if (!next) {
      setTyped("");
      setSent(false);
      setError(null);
    }
  };

  async function requestDeletion() {
    setSending(true);
    setError(null);
    const { error } = await authClient.deleteUser({
      callbackURL: `${window.location.origin}/sign-in?deleted=1`,
    });
    setSending(false);
    if (error) setError(error.message ?? "Could not start the deletion.");
    else setSent(true);
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        {sent ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <MailCheckIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Check your email</AlertDialogTitle>
              <AlertDialogDescription>
                We sent a confirmation link to {email}. Your account is deleted
                only when you open it. The link expires in 24 hours.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your account, all your bots and their
                chats, and your computer with every file on it. Anything your
                bots are doing stops. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form
              id="delete-account"
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (typed === CONFIRM_WORD) void requestDeletion();
              }}
            >
              <Label htmlFor="delete-confirm">
                Type {CONFIRM_WORD} to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                disabled={sending}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </form>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                form="delete-account"
                variant="destructive"
                disabled={typed !== CONFIRM_WORD || sending}
              >
                {sending && <Loader2Icon className="animate-spin" />}
                Email me a confirmation link
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
