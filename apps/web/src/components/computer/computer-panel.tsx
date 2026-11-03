"use client";

import {
  HandIcon,
  Loader2Icon,
  MaximizeIcon,
  MonitorIcon,
  MonitorOffIcon,
  PauseIcon,
  PowerIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useComputerContext } from "@/components/computer/computer-provider";
import { ComputerScreen } from "@/components/computer/computer-screen";
import {
  formatClock,
  useSecondsLeft,
} from "@/components/computer/session-wrap-up";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Computer, ComputerAction } from "@/hooks/use-computer";
import type { ActivityEvent, ComputerStatus } from "@/lib/computer/client";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<ComputerStatus["state"], string> = {
  off: "Not started",
  starting: "Starting…",
  running: "Live",
  paused: "Asleep",
  error: "Problem",
};

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

/** Time left in the session, once it is worth showing. */
function SessionClock({ computer }: { computer: Computer }) {
  const left = useSecondsLeft(computer.sessionEndsAt);
  if (left === null || computer.status?.state !== "running") return null;
  return (
    <span
      className={cn(
        "ml-auto text-xs tabular-nums text-muted-foreground",
        computer.status.session?.warning && "text-amber-500",
      )}
      title="Time left in this computer session"
    >
      {formatClock(left)}
    </span>
  );
}

/** Seconds since the computer started waking, so a slow start never looks frozen. */
function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(
      () => setElapsed(Math.round((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [active]);
  return elapsed;
}

/** The screen area when there is nothing live to watch: the last saved screen, dimmed, and how to wake it. */
function Asleep({ computer }: { computer: Computer }) {
  const { status, pending, snapshot } = computer;
  const starting = status?.state === "starting" || pending === "wake";
  const elapsed = useElapsed(starting);
  if (!status) return null;
  const limitReached = status.limitReached;
  return (
    <div className="relative flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
      {snapshot && (
        // biome-ignore lint/performance/noImgElement: a private blob: URL, not an optimisable asset
        <img
          src={snapshot}
          alt=""
          className="absolute inset-0 size-full object-contain opacity-30"
        />
      )}
      <div className="relative flex flex-col items-center gap-2 rounded-lg bg-background/70 px-4 py-3 backdrop-blur-sm">
        {starting ? (
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        ) : (
          <MonitorOffIcon className="size-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {starting
            ? `${status.message ?? "Waking the computer…"}${elapsed > 0 ? ` ${elapsed}s` : ""}`
            : "The computer is asleep"}
        </p>
        {!starting && (
          <p className="max-w-[16rem] text-xs text-muted-foreground">
            {limitReached
              ? "Today's computer time is used up. It resets at 00:00 UTC."
              : (status.message ??
                "Turn it on, or a bot asks you to when it needs it.")}
          </p>
        )}
        {!starting && !limitReached && (
          <Button size="sm" variant="outline" onClick={computer.wake}>
            <PowerIcon />
            Wake up
          </Button>
        )}
      </div>
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

/**
 * The computer in the bot page's right side bar: a live preview (click it for the full
 * screen), what the bots are doing, and today's usage. One computer per user, shared by
 * all of their bots.
 *
 * Full screen is the same element growing to cover the window, not a second viewer in a
 * dialog: moving an iframe to another place in the DOM reloads it, which is what made the
 * preview go black and reconnect. Here the live view keeps its connection throughout.
 */
export function ComputerPanel({
  botId,
  className,
}: {
  botId: string;
  className?: string;
}) {
  const computer = useComputerContext();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { status, inControl, busy, pending } = computer;
  const live = status?.state === "running";
  /** The button's own icon, or a spinner while its action runs. */
  const icon = (action: ComputerAction, idle: ReactNode) =>
    pending === action ? <Loader2Icon className="animate-spin" /> : idle;

  // Escape closes the full screen; focus moves into it when it opens.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Nothing to show full screen once the computer sleeps.
  useEffect(() => {
    if (!live && !inControl) setOpen(false);
  }, [live, inControl]);

  if (!status) {
    return (
      <div className={cn("flex flex-col gap-3 p-4", className)}>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="aspect-[16/10] w-full rounded-xl" />
      </div>
    );
  }

  const doing = who(status, botId);

  return (
    <div className={cn("flex min-h-0 flex-col gap-4 p-4", className)}>
      <div className="flex items-center gap-2">
        <MonitorIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Computer</h2>
        <StateBadge status={status} />
        <SessionClock computer={computer} />
      </div>

      {/* The same element is the preview and the full screen; only its classes change. */}
      <div
        {...(open
          ? {
              role: "dialog",
              "aria-modal": true,
              "aria-label": "Computer, full screen",
            }
          : {})}
        className={cn(
          open
            ? "fixed inset-0 z-50 flex flex-col gap-3 bg-background/95 p-3 backdrop-blur-sm"
            : "flex flex-col gap-2",
        )}
      >
        {open && (
          <div className="flex flex-wrap items-center gap-2">
            <MonitorIcon className="size-4" />
            <span className="text-sm font-medium">Computer</span>
            <StateBadge status={status} />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {doing ?? (live ? "Idle. Nobody is using the mouse." : "Asleep")}
            </span>
            {live &&
              (inControl ? (
                <Button
                  size="sm"
                  onClick={() => void computer.releaseControl()}
                  disabled={busy}
                  aria-busy={pending === "release"}
                >
                  {icon("release", <HandIcon />)}
                  Give control back
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void computer.takeControl()}
                  disabled={busy}
                  aria-busy={pending === "take"}
                >
                  {icon("take", <HandIcon />)}
                  Take control
                </Button>
              ))}
            {live && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void computer.pause()}
                disabled={busy}
                aria-busy={pending === "pause"}
              >
                {icon("pause", <PauseIcon />)}
                Sleep
              </Button>
            )}
            <Button
              ref={closeRef}
              size="icon-sm"
              variant="ghost"
              aria-label="Close full screen"
              onClick={() => setOpen(false)}
            >
              <XIcon />
            </Button>
          </div>
        )}

        <div
          className={cn(
            open
              ? "grid min-h-0 flex-1 gap-3 md:grid-cols-[1fr_16rem]"
              : "contents",
          )}
        >
          <div
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-black",
              open ? "min-h-0" : "aspect-[16/10]",
            )}
          >
            {live ? (
              <>
                <ComputerScreen
                  mode={inControl ? "control" : "watch"}
                  enabled={live}
                  poster={computer.snapshot}
                  title="Computer"
                  className={cn(
                    "size-full border-0",
                    !(open && inControl) && "pointer-events-none",
                  )}
                />
                {!open && (
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
                )}
                {doing && !open && (
                  <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-1 text-[11px] backdrop-blur">
                    {doing}
                  </span>
                )}
              </>
            ) : (
              <Asleep computer={computer} />
            )}
          </div>
          {open && (
            <aside className="hidden min-h-0 flex-col gap-3 md:flex">
              <p className="text-xs font-medium">Activity</p>
              <Activity
                events={computer.activity}
                botId={botId}
                className="min-h-0 flex-1"
              />
              <Usage status={status} />
            </aside>
          )}
        </div>

        {live && !open && (
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
              disabled={busy}
              aria-busy={pending === "pause"}
            >
              {icon("pause", <PauseIcon />)}
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
    </div>
  );
}
