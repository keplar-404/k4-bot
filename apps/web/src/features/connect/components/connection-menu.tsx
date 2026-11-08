"use client";

import {
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
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
import type { Connection } from "../api";

/** The "…" menu of a connected app: add another account, or disconnect one of them. */
export function ConnectionMenu({
  appName,
  connections,
  busy,
  onConnect,
  onDisconnect,
}: {
  appName: string;
  connections: Connection[];
  busy: boolean;
  onConnect: () => void;
  onDisconnect: (c: Connection) => void;
}) {
  return (
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
          <DropdownMenuItem onClick={onConnect}>
            <PlusIcon />
            Connect another account
          </DropdownMenuItem>
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
  );
}
