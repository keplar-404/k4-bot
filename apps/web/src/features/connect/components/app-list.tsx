"use client";

import { SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const HEAD = "font-medium text-muted-foreground text-xs";

/** The bordered list with its column labels (hidden on narrow screens, where rows stack). */
export function AppList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(13rem,auto)] gap-x-4 border-b bg-muted/30 px-4 py-2.5 md:grid">
        <span className={HEAD}>App</span>
        <span className={HEAD}>Category</span>
        <span className={HEAD}>Workflow use</span>
        <span className={HEAD}>Status</span>
      </div>
      <ul className="divide-y">{children}</ul>
    </div>
  );
}

export function AppListSkeleton({ rows = 8 }: { rows?: number }) {
  return Array.from({ length: rows }, (_, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
    <li key={i} className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="size-10 rounded-lg" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-8 w-24" />
    </li>
  ));
}

/** Nothing matches: says what was searched and offers the way out. */
export function AppListEmpty({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <li className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <SearchXIcon className="size-6 text-muted-foreground" />
      <p className="font-medium text-sm">{title}</p>
      <p className="max-w-sm text-muted-foreground text-sm">{hint}</p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </li>
  );
}

/** "Showing 50 of 1,723" and Load more. */
export function AppListFooter({
  shown,
  total,
  loading,
  onMore,
}: {
  shown: number;
  total: number;
  loading: boolean;
  onMore: () => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
      <span className="tabular-nums">
        Showing {shown.toLocaleString()} of {total.toLocaleString()}
      </span>
      {shown < total && (
        <Button variant="outline" size="sm" disabled={loading} onClick={onMore}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
