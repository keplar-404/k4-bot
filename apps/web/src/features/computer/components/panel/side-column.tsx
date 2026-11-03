import type { Computer } from "@/features/computer/hooks/use-computer";
import { Activity } from "./activity";
import { Usage } from "./usage";

/** The full screen's right column: the activity feed and today's usage. */
export function SideColumn({
  computer,
  botId,
}: {
  computer: Computer;
  botId: string;
}) {
  if (!computer.status) return null;
  return (
    <aside className="hidden min-h-0 flex-col gap-3 md:flex">
      <p className="text-xs font-medium">Activity</p>
      <Activity
        events={computer.activity}
        botId={botId}
        className="min-h-0 flex-1"
      />
      <Usage status={computer.status} />
    </aside>
  );
}
