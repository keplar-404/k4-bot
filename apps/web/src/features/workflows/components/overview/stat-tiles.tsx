import {
  ActivityIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  WorkflowIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { WorkflowListItem } from "../../api";

function Tile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="flex items-center gap-2 text-muted-foreground text-xs [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-2xl tabular-nums tracking-tight">
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </div>
  );
}

/** Four numbers that say how the user's automation is doing this week. */
export function StatTiles({ items }: { items: WorkflowListItem[] }) {
  const active = items.filter((w) => w.status === "active").length;
  const sum = (key: "runs7d" | "succeeded7d" | "failed7d") =>
    items.reduce((n, w) => n + (w.stats?.[key] ?? 0), 0);
  const runs = sum("runs7d");
  const ok = sum("succeeded7d");
  const failed = sum("failed7d");
  const rate = ok + failed ? `${Math.round((ok / (ok + failed)) * 100)}%` : "—";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        icon={<WorkflowIcon />}
        label="Workflows"
        value={String(items.length)}
        hint={`${active} on`}
      />
      <Tile
        icon={<ActivityIcon />}
        label="Runs"
        value={runs.toLocaleString()}
        hint="Last 7 days"
      />
      <Tile
        icon={<CircleCheckIcon />}
        label="Success rate"
        value={rate}
        hint={`${ok.toLocaleString()} succeeded`}
      />
      <Tile
        icon={<CircleAlertIcon />}
        label="Failed runs"
        value={failed.toLocaleString()}
        hint="Last 7 days"
      />
    </div>
  );
}
