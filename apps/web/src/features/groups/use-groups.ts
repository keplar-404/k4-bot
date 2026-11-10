"use client";

import { useEffect } from "react";
import { useGroupsStore } from "./store";

/** The user's groups from the shared store (loaded once; every create, change or delete updates it). */
export function useGroups() {
  const groups = useGroupsStore((s) => s.groups);
  const reload = useGroupsStore((s) => s.load);
  useEffect(() => {
    if (useGroupsStore.getState().groups === null) void reload();
  }, [reload]);
  return { groups, reload };
}
