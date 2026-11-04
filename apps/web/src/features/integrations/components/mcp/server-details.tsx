"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type CatalogMcp,
  connectMcp,
  type InstalledMcp,
} from "@/features/integrations/api";
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
  const [busy, setBusy] = useState(false);
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
      <p className="text-sm">{server.description}</p>
      <ServerCapabilities server={server} />
      {server.fields.length > 0 && (
        <TokenSection server={server} installed={installed} />
      )}
    </div>
  );
}
