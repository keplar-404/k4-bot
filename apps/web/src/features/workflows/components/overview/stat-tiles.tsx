import {
  ActivityIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  WorkflowIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RunRange, WorkflowListItem } from "../../api";
import { RANGE_INFO } from "./range";

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
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2 [&_svg]:size-3.5">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="font-semibold text-2xl tabular-nums tracking-tight">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-xs">
        {hint}
      </CardContent>
    </Card>
  );
}

/** Four numbers that say how the user's automation is doing in the chosen period. */
export function StatTiles({
  items,
  range,
}: {
  items: WorkflowListItem[];
  range: RunRange;
}) {
  const period = RANGE_INFO[range].period;
  const active = items.filter((w) => w.status === "active").length;
  const sum = (key: "runsInRange" | "succeededInRange" | "failedInRange") =>
    items.reduce((n, w) => n + (w.stats?.[key] ?? 0), 0);
  const runs = sum("runsInRange");
  const ok = sum("succeededInRange");
  const failed = sum("failedInRange");
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
        hint={period}
      />
      <Tile
        icon={<CircleCheckIcon />}
        label="Success rate"
        value={rate}
        hint={`${ok.toLocaleString()} succeeded · ${period.toLowerCase()}`}
      />
      <Tile
        icon={<CircleAlertIcon />}
        label="Failed runs"
        value={failed.toLocaleString()}
        hint={period}
      />
    </div>
  );
}
