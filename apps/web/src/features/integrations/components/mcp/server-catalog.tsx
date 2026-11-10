"use client";

import { CheckIcon, KeyRoundIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type CatalogMcp, connectMcp } from "@/features/integrations/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/** Every MCP server you can connect. A card opens its page; + connects it (apps that need a token open their page). */
export function ServerCatalog({
  catalog,
  onOpen,
}: {
  catalog: CatalogMcp[];
  onOpen: (serverId: string) => void;
}) {
  const [{ busy }, , store] = useLocalStore(() => ({
    busy: null as string | null,
  }));
  const setBusy = fieldSetter(store, "busy");
  const add = async (s: CatalogMcp) => {
    // Apps that need a token open their page, where the form is.
    if (s.fields.length > 0) return onOpen(s.id);
    setBusy(s.id);
    try {
      await connectMcp(s.id);
      toast.success(`${s.name} connected`, {
        description: "Add it to a bot when you create or edit the bot.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Available MCP servers</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {catalog.map((s) => {
          const connected = Boolean(s.connectedId);
          return (
            <li key={s.id}>
              {/* biome-ignore lint/a11y/useSemanticElements: the card holds its own connect button, so it cannot be a <button> */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(s.id);
                  }
                }}
                className="flex h-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {s.summary}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                    {s.fields.length > 0 ? (
                      <>
                        <KeyRoundIcon className="size-3" />
                        Needs a token
                      </>
                    ) : (
                      "Free, no key"
                    )}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant={connected ? "ghost" : "outline"}
                  disabled={connected || busy === s.id}
                  aria-label={
                    connected ? `${s.name} is connected` : `Connect ${s.name}`
                  }
                  title={connected ? "Connected" : "Connect"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void add(s);
                  }}
                >
                  {busy === s.id ? (
                    <Loader2Icon className="animate-spin" />
                  ) : connected ? (
                    <CheckIcon />
                  ) : (
                    <PlusIcon />
                  )}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
