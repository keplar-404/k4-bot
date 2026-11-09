"use client";

import { PlugIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authorizeApp } from "@/features/connect/api";
import { useConnections } from "@/features/connect/use-connections";
import { useNoAuth } from "./use-no-auth";

/**
 * Whether the user has connected this app. Connecting goes to Composio in this tab and comes back to this workflow
 * (the draft autosaves; the page warns if a save is still pending). "Check again" reloads the status.
 */
export function AppConnection({
  toolkit,
  appName,
}: {
  toolkit: string;
  appName: string;
}) {
  const conns = useConnections();
  const [opening, setOpening] = useState(false);
  const state = conns.stateOf(toolkit);
  const noAuth = useNoAuth(toolkit);

  const connect = async () => {
    setOpening(true);
    try {
      window.location.href = await authorizeApp(
        toolkit,
        window.location.pathname,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOpening(false);
    }
  };

  if (noAuth)
    return (
      <p className="text-muted-foreground text-sm">
        No login needed: {appName} works without connecting.
      </p>
    );
  if (!conns.ready)
    return (
      <p className="text-muted-foreground text-xs">
        Checking your {appName} connection…
      </p>
    );
  if (state.kind === "active") {
    const account = state.connections[0]?.account;
    return (
      <p className="flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
        Connected{account ? ` as ${account}` : ""}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="text-sm">
        {state.kind === "broken"
          ? `Your ${appName} connection stopped working.`
          : `Connect ${appName} so this step can run as you.`}
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void connect()} disabled={opening}>
          <PlugIcon />
          {state.kind === "broken" ? "Reconnect" : "Connect"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void conns.reload()}>
          <RefreshCwIcon />
          Check again
        </Button>
      </div>
    </div>
  );
}
