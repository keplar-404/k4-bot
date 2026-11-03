import { Badge } from "@/components/ui/badge";
import type { ComputerStatus } from "@/features/computer/api";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<ComputerStatus["state"], string> = {
  off: "Not started",
  starting: "Starting…",
  running: "Live",
  paused: "Asleep",
  error: "Problem",
};

export function who(status: ComputerStatus, botId: string): string | null {
  const lease = status.lease;
  if (!lease) return null;
  if (lease.kind === "user") return "You're in control";
  return lease.id === botId ? "This bot is working" : "Another bot is working";
}

export function StateBadge({ status }: { status: ComputerStatus }) {
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
