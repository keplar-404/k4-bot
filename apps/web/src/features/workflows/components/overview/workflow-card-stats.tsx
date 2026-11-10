import type { WorkflowListItem } from "../../api";
import { successRate, timeAgo } from "../../describe";
import { useWorkflowListStore } from "../../list-store";
import { RunStatusBadge } from "../status-badges";
import { RANGE_INFO } from "./range";

/** Runs and success rate in the overview's period, and how the last run ended. */
export function WorkflowCardStats({ w }: { w: WorkflowListItem }) {
  const range = useWorkflowListStore((s) => s.range);
  const rate = successRate(w.stats);
  return (
    <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
      <div>
        <dt className="text-muted-foreground">
          Runs · {RANGE_INFO[range].short}
        </dt>
        <dd className="font-medium text-sm tabular-nums">
          {(w.stats?.runsInRange ?? 0).toLocaleString()}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Success</dt>
        <dd className="font-medium text-sm tabular-nums">
          {rate === null ? "—" : `${rate}%`}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Last run</dt>
        <dd className="flex items-center gap-1 font-medium text-sm">
          {w.stats?.lastStatus ? (
            <RunStatusBadge status={w.stats.lastStatus} compact />
          ) : null}
          <span className="truncate text-muted-foreground text-xs">
            {timeAgo(w.lastRunAt)}
          </span>
        </dd>
      </div>
    </dl>
  );
}
