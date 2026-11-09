import type { Computer } from "@/features/computer/hooks/use-computer";
import { Activity } from "./activity";
import { Usage } from "./usage";

/** The full screen's right column: the activity feed and today's usage. */
export function SideColumn({
  computer,
  botId,
  shown,
}: {
  computer: Computer;
  botId: string;
  /** Forced open on screens below lg (where it starts hidden). */
  shown: boolean;
}) {
  if (!computer.status) return null;
  return (
    <aside
      className={`min-h-0 flex-col gap-3 lg:flex ${shown ? "flex" : "hidden"}`}
    >
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
