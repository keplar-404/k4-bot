"use client";

import { useCallback, useEffect, useState } from "react";
import { GROUPS_CHANGED, type Group, listGroups } from "./api";

/** The user's groups, reloaded whenever one is created, changed or deleted anywhere on the page. */
export function useGroups() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const reload = useCallback(
    () =>
      listGroups()
        .then(setGroups)
        .catch(() => setGroups((g) => g ?? [])),
    [],
  );
  useEffect(() => {
    void reload();
    window.addEventListener(GROUPS_CHANGED, reload);
    return () => window.removeEventListener(GROUPS_CHANGED, reload);
  }, [reload]);
  return { groups, reload };
}
