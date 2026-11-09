"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  // Connected servers and the catalog are separate tabs: one long scroll mixed what you have with what you could add.
  return (
    <Tabs
      defaultValue={mcp.installed.length > 0 ? "connected" : "browse"}
      className="gap-4"
    >
      <TabsList variant="line">
        <TabsTrigger value="connected">
          Connected ({mcp.installed.length})
        </TabsTrigger>
        <TabsTrigger value="browse">Browse ({mcp.catalog.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="connected">
        <ConnectedList installed={mcp.installed} onOpen={setSelected} />
      </TabsContent>
      <TabsContent value="browse">
        <ServerCatalog catalog={mcp.catalog} onOpen={setSelected} />
      </TabsContent>
    </Tabs>
  );
}
