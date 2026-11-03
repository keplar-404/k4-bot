"use client";

import { useEffect } from "react";
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
import type { Computer } from "@/features/computer/hooks/use-computer";
import { CloseOptionsHelp } from "./close-options-help";

/**
 * Shown when the user puts the computer to sleep while bots are using it. The server decides who is working
 * (it refuses the shutdown and returns them), so this is never based on a stale screen. The list follows the
 * live status: a bot that finishes disappears from it, and the dialog closes by itself when none is left.
 */
export function CloseComputerDialog({ computer }: { computer: Computer }) {
  const { blockers, status, busy, pending } = computer;

  // A status newer than the refusal that shows nobody working: nothing left to ask about.
  useEffect(() => {
    if (
      blockers &&
      status &&
      status.updatedAt > blockers.at &&
      (status.state !== "running" || status.working.length === 0)
    ) {
      computer.dismissBlockers();
    }
  }, [blockers, status, computer]);

  const fresh =
    blockers && status && status.updatedAt > blockers.at
      ? status.working
      : (blockers?.bots ?? []);

  return (
    <AlertDialog
      open={blockers !== null}
      onOpenChange={(open) => !open && computer.dismissBlockers()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {fresh.length === 1
              ? "A bot is using the computer"
              : "Bots are using the computer"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Shutting it down now stops their work. How do you want to close it?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul
          className="flex flex-col gap-1.5"
          aria-label="Bots using the computer"
        >
          {fresh.map((bot) => (
            <li key={bot.botId} className="flex items-center gap-2 text-sm">
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
              <span className="min-w-0 truncate">{bot.name}</span>
            </li>
          ))}
        </ul>

        <CloseOptionsHelp />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep running</AlertDialogCancel>
          <AlertDialogAction
            variant="secondary"
            disabled={busy}
            aria-busy={pending === "wrap"}
            onClick={() => void computer.wrapUp()}
          >
            Wrap up
          </AlertDialogAction>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            aria-busy={pending === "pause"}
            onClick={() => void computer.pause(true)}
          >
            Force shut down
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
