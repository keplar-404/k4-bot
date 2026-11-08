"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Empty state: no app chosen yet. */
export function AppSettingsEmpty() {
  return (
    <p className="p-4 text-muted-foreground text-sm">
      Choose an app from the library.
    </p>
  );
}

/** Loading state while the action's schema loads. */
export function AppSettingsLoading() {
  return <Skeleton className="h-24" />;
}
