"use client";

import { TimerIcon } from "lucide-react";
import { useEffect, useState } from "react";
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

/**
 * Human in the loop for the end of a computer session, shown in the chat like an approval:
 * "Wrap up" tells the bots to finish and summarise (the computer sleeps a couple of minutes
 * later); "Stop now" saves the computer's state and sleeps it at once.
 */
export function SessionWrapUp() {
  const computer = useComputerContext();
  const { status, busy, sessionEndsAt } = computer;
  const left = useSecondsLeft(sessionEndsAt);
  const session = status?.state === "running" ? status.session : undefined;
  if (!session?.warning || left === null) return null;

  return (
    <Item variant="outline" size="sm" role="alert">
      <ItemMedia variant="icon">
        <TimerIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="whitespace-normal">
          {session.wrapping
            ? `Wrapping up. The computer sleeps in ${formatClock(left)}.`
            : `The computer session ends in ${formatClock(left)}.`}
        </ItemTitle>
        <ItemDescription>
          {session.wrapping
            ? "Your bots are finishing and summarising what they did. Everything on the computer is saved."
            : "Wrap up to let your bots finish and summarise, or stop now. Everything on the computer is saved either way."}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void computer.pause()}
        >
          Stop now
        </Button>
        {!session.wrapping && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void computer.wrapUp()}
          >
            Wrap up
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
