"use client";

import { TimerIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useComputerContext } from "@/components/computer/computer-provider";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

/** Seconds until `endsAt` (local clock), ticking once a second while there is one. */
export function useSecondsLeft(endsAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt === null
    ? null
    : Math.max(0, Math.round((endsAt - now) / 1000));
}

export const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const names = (list: { name: string }[]) =>
  list.length <= 2
    ? list.map((b) => b.name).join(" and ")
    : `${list[0]?.name}, ${list[1]?.name} and ${list.length - 2} more`;

/**
 * Human in the loop for the end of the computer's time, shown in the chat like an approval. It appears shortly
 * before the computer sleeps by itself, because the session ends or today's computer time runs out.
 * "Wrap up" tells the bots to finish and summarise (the computer sleeps as soon as they are all done, saving the
 * minutes left); "Stop now" saves the state and sleeps it at once (asking first if bots are using it);
 * "Dismiss" does nothing: when the time is up it sleeps anyway, and with today's time used up nobody can wake it
 * until 00:00 UTC.
 */
export function SessionWrapUp() {
  const computer = useComputerContext();
  const { status, busy, sessionEndsAt } = computer;
  const left = useSecondsLeft(sessionEndsAt);
  const session = status?.state === "running" ? status.session : undefined;
  const reason = session?.reason;
  const warning = Boolean(session?.warning);
  const [dismissed, setDismissed] = useState<string | null>(null);

  // One toast per warning, so a user who is looking at another tab still notices.
  useEffect(() => {
    if (warning && reason === "quota" && !session?.wrapping) {
      toast.warning("Today's computer time is almost used up", {
        id: "computer-quota",
        description: "Wrap up what your bots are doing: the computer shuts down when it runs out.",
      });
    }
  }, [warning, reason, session?.wrapping]);

  if (!session?.warning || left === null || (dismissed === reason && !session.wrapping)) return null;
  const quota = reason === "quota";
  const working = status?.working ?? [];

  return (
    <Item variant="outline" size="sm" role="alert">
      <ItemMedia variant="icon">
        <TimerIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="whitespace-normal">
          {session.wrapping
            ? `Wrapping up. The computer sleeps in at most ${formatClock(left)}.`
            : quota
              ? `Today's computer time ends in ${formatClock(left)}.`
              : `The computer session ends in ${formatClock(left)}.`}
        </ItemTitle>
        <ItemDescription>
          {session.wrapping
            ? working.length > 0
              ? `Waiting for ${names(working)} to finish and summarise. It sleeps as soon as they are done. Everything on the computer is saved.`
              : "Everything is saved."
            : quota
              ? "Then the computer shuts down and nobody can turn it on again until 00:00 UTC. Your bots have been told to save their work. Wrap up now to let them finish and keep the minutes that are left."
              : "Wrap up to let your bots finish and summarise, or stop now. Everything on the computer is saved either way."}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {!session.wrapping && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDismissed(reason ?? null)}>
            Dismiss
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void computer.pause()}>
          Stop now
        </Button>
        {!session.wrapping && (
          <Button size="sm" disabled={busy} onClick={() => void computer.wrapUp()}>
            Wrap up
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
