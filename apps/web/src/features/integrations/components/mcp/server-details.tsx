"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type CatalogMcp,
  connectMcp,
  type InstalledMcp,
} from "@/features/integrations/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { ServerCapabilities } from "./server-capabilities";
import { TestConnectionButton } from "./test-connection-button";
import { TokenSection } from "./token-section";

export function ServerDetails({
  server,
  installed,
  onBack,
}: {
  server: CatalogMcp;
  installed?: InstalledMcp;
  onBack: () => void;
}) {
  const [{ busy }, , store] = useLocalStore(() => ({
    busy: false,
  }));
  const setBusy = fieldSetter(store, "busy");
  const connectNoKey = async () => {
    setBusy(true);
    try {
      await connectMcp(server.id);
      toast.success(`${server.name} connected`, {
        description: "Add it to a bot when you create or edit the bot.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeftIcon />
          All MCP servers
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold">{server.name}</h3>
          <p className="text-sm text-muted-foreground">
            {server.publisher} ·{" "}
            <a
              href={server.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              Docs
              <ExternalLinkIcon className="size-3" />
            </a>
          </p>
        </div>
        {installed ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <CheckIcon />
              Connected
            </Badge>
            <TestConnectionButton id={installed.id} name={server.name} />
          </div>
        ) : (
          server.fields.length === 0 && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void connectNoKey()}
            >
              {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              Connect
            </Button>
          )
        )}
      </header>
      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tools">What it can do</TabsTrigger>
          {server.fields.length > 0 && (
            <TabsTrigger value="access">Access token</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="overview">
          <p className="text-sm">{server.description}</p>
        </TabsContent>
        <TabsContent value="tools">
          <ServerCapabilities server={server} />
        </TabsContent>
        {server.fields.length > 0 && (
          <TabsContent value="access">
            <TokenSection server={server} installed={installed} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
