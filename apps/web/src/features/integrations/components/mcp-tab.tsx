"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntegrations } from "@/features/integrations/api";
import { ConnectedList } from "./mcp/connected-list";
import { ServerCatalog } from "./mcp/server-catalog";
import { ServerDetails } from "./mcp/server-details";

/** Connected apps (MCP servers). A card opens its details; + connects it (asking for a token when it needs one). */
export function McpTab() {
  const { mcp, error } = useIntegrations();
  const [selected, setSelected] = useState<string | null>(null);

  if (error && !mcp) return <p className="text-sm text-destructive">{error}</p>;
  if (!mcp)
    return (
      <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );

  const server = mcp.catalog.find((s) => s.id === selected);
  if (server)
    return (
      <ServerDetails
        server={server}
        installed={mcp.installed.find((i) => i.serverId === server.id)}
        onBack={() => setSelected(null)}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <ConnectedList installed={mcp.installed} onOpen={setSelected} />
      <ServerCatalog catalog={mcp.catalog} onOpen={setSelected} />
    </div>
  );
}
