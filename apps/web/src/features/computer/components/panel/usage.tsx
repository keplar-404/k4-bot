import { Progress } from "@/components/ui/progress";
import type { ComputerStatus } from "@/features/computer/api";

export function Usage({ status }: { status: ComputerStatus }) {
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
