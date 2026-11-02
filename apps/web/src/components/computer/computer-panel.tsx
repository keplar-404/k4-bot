"use client";

import {
  HandIcon,
  Loader2Icon,
  MaximizeIcon,
  MonitorIcon,
  MonitorOffIcon,
  PauseIcon,
  PowerIcon,
} from "lucide-react";
import { useState } from "react";
import { ComputerScreen } from "@/components/computer/computer-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useComputer } from "@/hooks/use-computer";
import type { ActivityEvent, ComputerStatus } from "@/lib/computer/client";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<ComputerStatus["state"], string> = {
  off: "Not started",
  starting: "Starting…",
  running: "Live",
  paused: "Asleep",
  error: "Problem",
};

type Computer = ReturnType<typeof useComputer>;

function who(status: ComputerStatus, botId: string): string | null {
  const lease = status.lease;
  if (!lease) return null;
  if (lease.kind === "user") return "You're in control";
  return lease.id === botId ? "This bot is working" : "Another bot is working";
}

function StateBadge({ status }: { status: ComputerStatus }) {
  return (
    <Badge variant={status.state === "error" ? "destructive" : "secondary"}>
      <span
        className={cn(
          "size-1.5 rounded-full bg-muted-foreground",
          status.state === "running" && "animate-pulse bg-emerald-500",
          status.state === "starting" && "animate-pulse bg-amber-500",
          status.state === "error" && "bg-destructive",
        )}
      />
      {STATE_LABEL[status.state]}
    </Badge>
  );
}

/** What the screen area shows when there is nothing live to watch. */
function Asleep({
  status,
  busy,
  onWake,
}: {
  status: ComputerStatus;
  busy: boolean;
  onWake: () => void;
}) {
  const starting = status.state === "starting" || busy;
  const limitReached = status.minutesUsedToday >= status.minutesLimit;
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
      {starting ? (
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      ) : (
        <MonitorOffIcon className="size-6 text-muted-foreground" />
      )}
      <p className="text-sm font-medium">
        {starting ? "Waking the computer…" : "The computer is asleep"}
      </p>
      <p className="max-w-[16rem] text-xs text-muted-foreground">
        {status.message ??
          (limitReached
            ? "Today's computer time is used up. It resets at 00:00 UTC."
            : "Your bots wake it when they need it, and it sleeps again by itself when idle.")}
      </p>
      {!starting && !limitReached && (
        <Button size="sm" variant="outline" onClick={onWake}>
          <PowerIcon />
          Wake up
        </Button>
      )}
    </div>
  );
}

function Activity({
  events,
  botId,
  className,
}: {
  events: ActivityEvent[];
  botId: string;
  className?: string;
}) {
  const shown = [...events].reverse();
  return (
    <ol className={cn("flex flex-col gap-1.5 overflow-y-auto", className)}>
      {shown.length === 0 && (
        <li className="text-xs text-muted-foreground">
          Nothing yet. What your bots do on the computer shows up here.
        </li>
      )}
      {shown.map((e) => (
        <li key={`${e.at}-${e.botId}-${e.text}`} className="flex gap-2 text-xs">
          <time className="shrink-0 tabular-nums text-muted-foreground">
            {new Date(e.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
          <span
            className={cn(
              "min-w-0 break-words",
              e.botId !== botId && "text-muted-foreground",
            )}
          >
            {e.botId !== botId && "Another bot: "}
            {e.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Usage({ status }: { status: ComputerStatus }) {
  const pct = Math.min(
    100,
    Math.round(
      (status.minutesUsedToday / Math.max(1, status.minutesLimit)) * 100,
    ),
  );
  return (
    <div className="flex flex-col gap-1">
      <Progress value={pct} aria-label="Computer time used today" />
      <p className="text-[11px] text-muted-foreground">
        {status.minutesUsedToday} of {status.minutesLimit} min used today
      </p>
    </div>
  );
}

/** Full-screen view: the whole desktop, what the bots are doing, and the user's take-over. */
function FullscreenComputer({
  computer,
  botId,
  open,
  onOpenChange,
}: {
  computer: Computer;
  botId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { status, inControl, busy, error } = computer;
  if (!status) return null;
  const live = status.state === "running";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="h-[92svh] w-[96vw] max-w-none grid-rows-[auto_1fr] gap-3 p-3 sm:max-w-none"
      >
        <div className="flex flex-wrap items-center gap-2 pr-10">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MonitorIcon className="size-4" />
            Computer
          </DialogTitle>
          <StateBadge status={status} />
          <DialogDescription className="min-w-0 flex-1 truncate text-xs">
            {who(status, botId) ??
              (live ? "Idle. Nobody is using the mouse." : "Asleep")}
          </DialogDescription>
          {live &&
            (inControl ? (
              <Button
                size="sm"
                onClick={() => void computer.releaseControl()}
                disabled={busy}
              >
                <HandIcon />
                Give control back
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void computer.takeControl()}
                disabled={busy}
              >
                <HandIcon />
                Take control
              </Button>
            ))}
          {live && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void computer.pause()}
              disabled={busy}
            >
              <PauseIcon />
              Sleep
            </Button>
          )}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
        <div className="grid min-h-0 gap-3 md:grid-cols-[1fr_16rem]">
          <div className="relative min-h-0 overflow-hidden rounded-lg border bg-black">
            {live ? (
              <ComputerScreen
                mode={inControl ? "control" : "watch"}
                enabled={open && live}
                title="Computer"
                className="size-full border-0"
              />
            ) : (
              <Asleep status={status} busy={busy} onWake={computer.wake} />
            )}
          </div>
          <aside className="hidden min-h-0 flex-col gap-3 md:flex">
            <p className="text-xs font-medium">Activity</p>
            <Activity
              events={computer.activity}
              botId={botId}
              className="min-h-0 flex-1"
            />
            <Usage status={status} />
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The computer in the bot page's right side bar: a live preview (click it for the
 * full screen), what the bots are doing, and today's usage. One computer per user,
 * shared by all of their bots.
 */
export function ComputerPanel({
  botId,
  className,
}: {
  botId: string;
  className?: string;
}) {
  const computer = useComputer();
  const [open, setOpen] = useState(false);
  const { status } = computer;

  if (!status) {
    return (
      <div className={cn("flex flex-col gap-3 p-4", className)}>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="aspect-[16/10] w-full rounded-xl" />
      </div>
    );
  }

  const live = status.state === "running";
  const doing = who(status, botId);

  return (
    <div className={cn("flex min-h-0 flex-col gap-4 p-4", className)}>
      <div className="flex items-center gap-2">
        <MonitorIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Computer</h2>
        <StateBadge status={status} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="group relative aspect-[16/10] overflow-hidden rounded-xl border bg-black">
          {live ? (
            <>
              <ComputerScreen
                mode="watch"
                enabled={live && !open}
                title="Computer preview"
                className="pointer-events-none size-full border-0"
              />
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open the computer full screen"
                className="absolute inset-0 flex items-end justify-end bg-transparent p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="rounded-md bg-background/80 p-1.5 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <MaximizeIcon className="size-4" />
                </span>
              </button>
              {doing && (
                <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-1 text-[11px] backdrop-blur">
                  {doing}
                </span>
              )}
            </>
          ) : (
            <Asleep
              status={status}
              busy={computer.busy}
              onWake={computer.wake}
            />
          )}
        </div>
        {live && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(true)}
            >
              <MaximizeIcon />
              Open
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void computer.pause()}
              disabled={computer.busy}
            >
              <PauseIcon />
              Sleep
            </Button>
          </div>
        )}
        {computer.error && (
          <p className="text-xs text-destructive">{computer.error}</p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Activity</h3>
        <Activity
          events={computer.activity}
          botId={botId}
          className="min-h-0 flex-1"
        />
      </div>

      <Usage status={status} />

      <FullscreenComputer
        computer={computer}
        botId={botId}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
