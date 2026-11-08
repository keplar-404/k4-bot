"use client";

import { cn } from "cn";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Connection } from "../api";
import type { AppConnectionState } from "../use-connections";
import { ConnectionMenu } from "./connection-menu";

type Props = {
  appName: string;
  noAuth: boolean;
  state: AppConnectionState;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: (c: Connection) => void;
};

/** The status column: a Connect button, or a green "Connected" (amber "Needs reconnect") with the account menu. */
export function ConnectionCell({
  appName,
  noAuth,
  state,
  busy,
  onConnect,
  onDisconnect,
}: Props) {
  if (noAuth)
    return (
      <span className="text-muted-foreground text-xs">No account needed</span>
    );
  if (state.kind === "none") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onConnect}
        aria-label={`Connect ${appName}`}
      >
        {busy && <Loader2Icon className="animate-spin" />}
        Connect
      </Button>
    );
  }
  const first = state.connections[0];
  const active = state.kind === "active";
  return (
    <div className="flex items-center justify-end gap-1 md:justify-start">
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 font-medium text-sm">
          <span
            className={cn(
              "size-2 rounded-full",
              active ? "bg-emerald-500" : "bg-amber-500",
            )}
            aria-hidden
          />
          {active ? "Connected" : "Needs reconnect"}
          {state.connections.length > 1 && (
            <span className="text-muted-foreground text-xs">
              · {state.connections.length} accounts
            </span>
          )}
        </span>
        {first?.account && (
          <span className="max-w-44 truncate text-muted-foreground text-xs">
            {first.account}
          </span>
        )}
      </div>
      {!active && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onConnect}
          className="ml-2"
        >
          <RefreshCwIcon />
          Reconnect
        </Button>
      )}
      <ConnectionMenu
        appName={appName}
        connections={state.connections}
        busy={busy}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />
    </div>
  );
}
