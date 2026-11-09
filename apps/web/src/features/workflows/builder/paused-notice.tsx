"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useBuilder } from "./store";

/** Why the system turned this workflow off, until it is turned on again. */
export function PausedNotice() {
  const reason = useBuilder((s) =>
    s.workflow?.status === "paused" ? s.workflow.pausedReason : null,
  );
  if (!reason) return null;
  return (
    <output className="flex items-start gap-2 border-b bg-amber-500/10 px-4 py-2 text-amber-800 text-sm dark:text-amber-300">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      {reason}
    </output>
  );
}
