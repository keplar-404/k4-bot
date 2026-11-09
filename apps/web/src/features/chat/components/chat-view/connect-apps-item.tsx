"use client";

import { CheckIcon, PlugIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authorizeApp } from "@/features/connect/api";
import { AppLogo } from "@/features/connect/components/app-logo";
import { useConnections } from "@/features/connect/use-connections";

type App = { toolkit: string; name: string; logo: string | null };

/**
 * The bot needs apps connected to go on: one row per app with its logo and a Connect button. Connecting comes back to
 * this chat; once every app shows Connected the user continues, and the server checks again before the bot goes on.
 */
export function ConnectAppsItem({
  apps,
  why,
  onDone,
}: {
  apps: App[];
  why?: string;
  onDone: (answer: "connected" | "skipped") => void;
}) {
  const conns = useConnections();
  const connected = (toolkit: string) =>
    conns.stateOf(toolkit).kind === "active";
  const all = conns.ready && apps.every((a) => connected(a.toolkit));

  const connect = async (toolkit: string) => {
    try {
      window.location.href = await authorizeApp(
        toolkit,
        window.location.pathname,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div>
        <p className="font-medium text-sm">Connect apps to continue</p>
        {why && <p className="text-muted-foreground text-sm">{why}</p>}
      </div>
      <ul className="flex flex-col gap-2">
        {apps.map((app) => (
          <li
            key={app.toolkit}
            className="flex items-center gap-3 rounded-lg border px-3 py-2"
          >
            <AppLogo src={app.logo} name={app.name} size="sm" />
            <span className="min-w-0 flex-1 truncate font-medium text-sm">
              {app.name}
            </span>
            {connected(app.toolkit) ? (
              <span className="flex items-center gap-1 text-emerald-600 text-xs dark:text-emerald-400">
                <CheckIcon className="size-3.5" /> Connected
              </span>
            ) : (
              <Button size="sm" onClick={() => void connect(app.toolkit)}>
                <PlugIcon /> Connect
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onDone("skipped")}>
          Not now
        </Button>
        <Button size="sm" variant="outline" onClick={() => void conns.reload()}>
          Check again
        </Button>
        <Button size="sm" disabled={!all} onClick={() => onDone("connected")}>
          Continue
        </Button>
      </div>
    </div>
  );
}
