import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleSlashIcon,
  LoaderIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RunStatus, WorkflowStatus } from "../api";

/** On / Off / Draft, with a dot, never colour alone. */
export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const map = {
    active: { label: "On", dot: "bg-emerald-500" },
    paused: { label: "Off", dot: "bg-muted-foreground" },
    draft: { label: "Draft", dot: "bg-amber-500" },
  }[status];
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className={`size-1.5 rounded-full ${map.dot}`} aria-hidden />
      {map.label}
    </Badge>
  );
}

const RUN = {
  queued: {
    label: "Queued",
    icon: CircleDashedIcon,
    tone: "text-muted-foreground",
  },
  running: {
    label: "Running",
    icon: LoaderIcon,
    tone: "text-sky-600 dark:text-sky-400",
  },
  succeeded: {
    label: "Succeeded",
    icon: CircleCheckIcon,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  failed: { label: "Failed", icon: CircleAlertIcon, tone: "text-destructive" },
  cancelled: {
    label: "Cancelled",
    icon: CircleSlashIcon,
    tone: "text-muted-foreground",
  },
} as const;

/** A run's outcome: icon + label (the label is hidden visually in `compact`, but read by screen readers). */
export function RunStatusBadge({
  status,
  compact = false,
}: {
  status: RunStatus;
  compact?: boolean;
}) {
  const s = RUN[status];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${s.tone}`}
      title={s.label}
    >
      <Icon
        className={`size-3.5 ${status === "running" ? "animate-spin" : ""}`}
        aria-hidden
      />
      <span className={compact ? "sr-only" : ""}>{s.label}</span>
    </span>
  );
}
