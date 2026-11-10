"use client";

import {
  Loader2Icon,
  MonitorIcon,
  MoreHorizontalIcon,
  UnplugIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import type { Connection } from "../api";
import { BotLoginDialog } from "./bot-login-dialog";

/** The "…" menu of a connected app: log in on a bot's computer, or disconnect it (one account per app). */
export function ConnectionMenu({
  appName,
  connections,
  busy,
  onDisconnect,
}: {
  appName: string;
  connections: Connection[];
  busy: boolean;
  onDisconnect: (c: Connection) => void;
}) {
  const [loginOpen, setLoginOpen] = useState(false);
  const hasActive = connections.some((c) => c.status === "ACTIVE");
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            className="ml-1"
            disabled={busy}
          />
        }
      >
        {busy ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <MoreHorizontalIcon />
        )}
        <span className="sr-only">More for {appName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{appName}</DropdownMenuLabel>
          {hasActive && (
            <DropdownMenuItem onClick={() => setLoginOpen(true)}>
              <MonitorIcon />
              Log in on a bot&apos;s computer…
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {connections.map((c) => (
          <DropdownMenuItem
            key={c.id}
            variant="destructive"
            onClick={() => onDisconnect(c)}
          >
            <UnplugIcon />
            <span className="truncate">
              Disconnect {c.account ?? "this account"}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
    <BotLoginDialog appName={appName} connections={connections} open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
