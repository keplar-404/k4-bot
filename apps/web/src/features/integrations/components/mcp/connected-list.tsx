"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectMcp, type InstalledMcp } from "@/features/integrations/api";

/** The connected apps, each opening its page, with Disconnect (deletes the saved token). */
export function ConnectedList({
  installed,
  onOpen,
}: {
  installed: InstalledMcp[];
  onOpen: (serverId: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const remove = async (i: InstalledMcp) => {
    setBusy(i.id);
    try {
      await disconnectMcp(i.id);
      toast.success(`${i.name} disconnected`, {
        description: "Its saved token was deleted.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Connected</h3>
      {installed.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No apps connected yet. Connect one below, then add it to a bot from
          the bot&apos;s settings.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {installed.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpen(i.serverId)}
              >
                <p className="truncate text-sm font-medium">{i.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {i.needsSecrets
                    ? `Token ending in ${i.secretHint ?? "…"}`
                    : "No key needed"}
                </p>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Disconnect ${i.name}`}
                title="Disconnect (deletes the saved token, removes it from your bots)"
                disabled={busy === i.id}
                onClick={() => void remove(i)}
              >
                {busy === i.id ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <Trash2Icon />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
