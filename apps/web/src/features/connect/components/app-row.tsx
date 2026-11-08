"use client";

import { Badge } from "@/components/ui/badge";
import type { CatalogApp, Connection } from "../api";
import { categoryLabel } from "../category-label";
import type { AppConnectionState } from "../use-connections";
import { AppLogo } from "./app-logo";
import { ConnectionCell } from "./connection-cell";

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/**
 * One app in the list: logo, name and what it is for; its categories; what a workflow can do with it; and the
 * connection status. On narrow screens the middle columns fold away and the status stays on the right.
 */
export function AppRow({
  app,
  state,
  busy,
  onConnect,
  onDisconnect,
}: {
  app: CatalogApp;
  state: AppConnectionState;
  busy: boolean;
  onConnect: (slug: string) => void;
  onDisconnect: (c: Connection, appName: string) => void;
}) {
  const [first, ...rest] = app.categories;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(13rem,auto)]">
      <div className="flex min-w-0 items-center gap-3">
        <AppLogo src={app.logo} name={app.name} />
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{app.name}</p>
          <p className="line-clamp-1 text-muted-foreground text-xs">
            {app.description || "No description."}
          </p>
        </div>
      </div>
      <div className="hidden min-w-0 items-center gap-1 md:flex">
        {first ? (
          <Badge variant="secondary" className="max-w-full truncate">
            {categoryLabel(first.name)}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
        {rest.length > 0 && (
          <span
            className="text-muted-foreground text-xs"
            title={rest.map((c) => categoryLabel(c.name)).join(", ")}
          >
            +{rest.length}
          </span>
        )}
      </div>
      <p className="hidden text-muted-foreground text-xs tabular-nums md:block">
        {plural(app.toolsCount, "action")}
        {app.triggersCount > 0 && (
          <> · {plural(app.triggersCount, "trigger")}</>
        )}
      </p>
      <div className="flex justify-end md:justify-start">
        <ConnectionCell
          appName={app.name}
          noAuth={app.noAuth}
          state={state}
          busy={busy}
          onConnect={() => onConnect(app.slug)}
          onDisconnect={(c) => onDisconnect(c, app.name)}
        />
      </div>
    </li>
  );
}
