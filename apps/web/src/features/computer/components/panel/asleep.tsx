import { Loader2Icon, MonitorOffIcon, PowerIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Computer } from "@/features/computer/hooks/use-computer";

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
export function Asleep({ computer }: { computer: Computer }) {
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
