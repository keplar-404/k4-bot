"use client";

import type { CatalogApp, Connection } from "../api";
import type { AppConnectionState } from "../use-connections";
import { AppList, AppListEmpty, AppListSkeleton } from "./app-list";
import { AppRow } from "./app-row";

type Props = {
  items: CatalogApp[];
  loading: boolean;
  query: string;
  onlyConnected: boolean;
  filtered: boolean;
  stateOf: (slug: string) => AppConnectionState;
  busySlug: string | null;
  onConnect: (slug: string) => void;
  onDisconnect: (c: Connection, appName: string) => void;
  onClear: () => void;
  onShowAll: () => void;
};

/** The list body: placeholders while the first page loads, an empty state that says why, or the apps. */
export function AppResults(p: Props) {
  if (p.loading && p.items.length === 0) {
    return (
      <AppList>
        <AppListSkeleton />
      </AppList>
    );
  }
  if (p.items.length === 0) {
    return (
      <AppList>
        {p.onlyConnected && !p.filtered ? (
          <AppListEmpty
            title="No apps connected yet"
            hint="Connect an app to use it in workflows and let your bots act on it."
            action={{ label: "Browse all apps", onClick: p.onShowAll }}
          />
        ) : (
          <AppListEmpty
            title="No apps match"
            hint={
              p.query
                ? `Nothing found for “${p.query}”.`
                : "No apps in this category."
            }
            action={{ label: "Clear filters", onClick: p.onClear }}
          />
        )}
      </AppList>
    );
  }
  return (
    <AppList>
      {p.items.map((app) => (
        <AppRow
          key={app.slug}
          app={app}
          state={p.stateOf(app.slug)}
          busy={p.busySlug === app.slug}
          onConnect={p.onConnect}
          onDisconnect={p.onDisconnect}
        />
      ))}
    </AppList>
  );
}
