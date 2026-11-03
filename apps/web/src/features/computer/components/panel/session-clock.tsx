import type { Computer } from "@/features/computer/hooks/use-computer";
import {
  formatClock,
  useSecondsLeft,
} from "@/features/computer/hooks/use-seconds-left";
import { cn } from "@/lib/utils";

/** Time left in the session, once it is worth showing. */
export function SessionClock({ computer }: { computer: Computer }) {
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
