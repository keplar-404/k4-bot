"use client";

import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChatHttpError } from "@/features/chat/lib/client";
import { resetComputer, type WorkingBot } from "@/features/computer/api";

/** The step of the reset dialog: closed, asking, or asking again because bots are working. */
type Step = null | { working: WorkingBot[] };

/**
 * Wipes the computer to a brand-new machine. The first confirmation asks without forcing: if bots are working
 * the server refuses and names them (it is the judge, not this screen), and only a second "Reset anyway"
 * forces it and stops their runs.
 */
export function ResetComputer({ disabled }: { disabled?: boolean }) {
  const [step, setStep] = useState<Step>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = async (force: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await resetComputer(force);
      if (result.closed) setStep(null);
      else setStep({ working: result.working });
    } catch (e) {
      setError(
        e instanceof ChatHttpError
          ? e.info.message
          : "Could not reset the computer.",
      );
    } finally {
      setBusy(false);
    }
  };

  const working = step?.working ?? [];

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Reset computer</CardTitle>
        <CardDescription>
          Wipes the computer to a brand-new machine: every bot&apos;s files,
          browser data and open apps are deleted. This cannot be undone. Files
          saved to your Files page are kept.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button
          variant="destructive"
          className="self-start"
          disabled={disabled || busy}
          onClick={() => setStep({ working: [] })}
        >
          <RotateCcwIcon />
          Reset computer
        </Button>
        {error && !step && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>

      <AlertDialog
        open={step !== null}
        onOpenChange={(open) => !open && !busy && setStep(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {working.length === 0
                ? "Reset the computer?"
                : working.length === 1
                  ? "A bot is using the computer"
                  : "Bots are using the computer"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {working.length === 0
                ? "Everything on it is deleted and every open app is closed. The next wake-up starts a brand-new computer."
                : "Resetting now stops their work and deletes everything on the computer. Do you still want to reset it?"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {working.length > 0 && (
            <ul
              className="flex flex-col gap-1.5"
              aria-label="Bots using the computer"
            >
              {working.map((bot) => (
                <li key={bot.botId} className="flex items-center gap-2 text-sm">
                  <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                  <span className="min-w-0 truncate">{bot.name}</span>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void reset(working.length > 0)}
            >
              {busy && <Loader2Icon className="animate-spin" />}
              {working.length > 0 ? "Stop bots and reset" : "Reset"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
