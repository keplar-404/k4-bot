"use client";

import { TimerIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useComputerContext } from "@/features/computer/components/computer-provider";
import {
  formatClock,
  useSecondsLeft,
} from "@/features/computer/hooks/use-seconds-left";
import { useQuotaToast, wrapUpText } from "./wrap-up-text";

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

  useQuotaToast(warning && reason === "quota" && !session?.wrapping);

  if (
    !session?.warning ||
    left === null ||
    (dismissed === reason && !session.wrapping)
  )
    return null;
  const text = wrapUpText({
    wrapping: session.wrapping,
    quota: reason === "quota",
    clock: formatClock(left),
    working: status?.working ?? [],
  });

  return (
    <Item variant="outline" size="sm" role="alert">
      <ItemMedia variant="icon">
        <TimerIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="whitespace-normal">{text.title}</ItemTitle>
        <ItemDescription>{text.description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {!session.wrapping && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setDismissed(reason ?? null)}
          >
            Dismiss
          </Button>
        )}
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
