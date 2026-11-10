"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrowserTab } from "@/features/workspace/browser/browser-tab";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { previewUrl } from "./api";
import { TerminalPane } from "./terminal-pane";
import type { TerminalLine } from "./types";

/** The app the bot is serving: pick its port, then it opens in the panel's browser (public E2B preview URL). */
function Preview({ botId }: { botId: string }) {
  const [{ port, url, error }, , store] = useLocalStore(() => ({
    port: "3000",
    url: null as string | null,
    error: null as string | null,
  }));
  const setPort = fieldSetter(store, "port");
  const setUrl = fieldSetter(store, "url");
  const setError = fieldSetter(store, "error");
  const show = async () => {
    try {
      setUrl(await previewUrl(botId, Number(port)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b p-2">
        <Input
          aria-label="Port"
          inputMode="numeric"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          className="h-8 w-24"
        />
        <Button size="sm" onClick={() => void show()}>
          Show
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
      {url ? (
        <BrowserTab key={url} url={url} />
      ) : (
        <p className="p-3 text-xs text-muted-foreground">
          Start a server in the sandbox (the bot can), then show its port.
        </p>
      )}
    </div>
  );
}

/** The editor's right column: the bot's commands, and a preview of the app it serves. */
export function SidePanes({
  botId,
  terminal,
}: {
  botId: string;
  terminal: TerminalLine[];
}) {
  return (
    <Tabs
      defaultValue="terminal"
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <TabsList className="m-1">
        <TabsTrigger value="terminal">Terminal</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="terminal" className="min-h-0 flex-1 overflow-hidden">
        <TerminalPane lines={terminal} />
      </TabsContent>
      <TabsContent
        value="preview"
        keepMounted
        className="min-h-0 flex-1 data-[hidden]:hidden"
      >
        <Preview botId={botId} />
      </TabsContent>
    </Tabs>
  );
}
