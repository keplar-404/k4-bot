import { MonitorIcon } from "lucide-react";
import type { ComputerStatus } from "@/features/computer/api";
import type { Computer } from "@/features/computer/hooks/use-computer";
import { SessionClock } from "./session-clock";
import { StateBadge } from "./state-badge";

/** Header row: icon, title, state badge, session clock. */
export function PanelHeader({
  computer,
  status,
}: {
  computer: Computer;
  status: ComputerStatus;
}) {
  return (
    <div className="flex items-center gap-2">
      <MonitorIcon className="size-4 text-muted-foreground" />
      <h2 className="text-sm font-medium">Computer</h2>
      <StateBadge status={status} />
      <SessionClock computer={computer} />
    </div>
  );
}
