"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type StatusFilter = "all" | "connected";

/** All / Connected tabs with a connected count badge. */
export function StatusFilter({
  status,
  connectedCount,
  onStatus,
}: {
  status: StatusFilter;
  connectedCount: number;
  onStatus: (s: StatusFilter) => void;
}) {
  return (
    <Tabs value={status} onValueChange={(v) => onStatus(v as StatusFilter)}>
      <TabsList>
        <TabsTrigger value="all">All apps</TabsTrigger>
        <TabsTrigger value="connected">
          Connected
          <span className="ml-1 rounded-full bg-muted px-1.5 text-muted-foreground text-xs tabular-nums">
            {connectedCount}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
