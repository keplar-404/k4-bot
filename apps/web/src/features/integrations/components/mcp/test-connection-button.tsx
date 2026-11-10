"use client";

import { Loader2Icon, PlugZapIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { testMcp } from "@/features/integrations/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/**
 * Tests a connected app for real: the server connects with the saved token and lists the app's tools. The toast
 * says what came back (how many tools, how long it took) or why it failed.
 */
export function TestConnectionButton({
  id,
  name,
  compact = false,
}: {
  id: string;
  name: string;
  compact?: boolean;
}) {
  const [{ busy }, , store] = useLocalStore(() => ({
    busy: false,
  }));
  const setBusy = fieldSetter(store, "busy");
  const run = async () => {
    setBusy(true);
    try {
      const result = await testMcp(id);
      if (result.ok) {
        toast.success(`${name} is working`, {
          description: `Answered in ${result.ms} ms with ${result.tools.length} tool${result.tools.length === 1 ? "" : "s"}: ${result.tools.slice(0, 4).join(", ")}${result.tools.length > 4 ? "…" : ""}`,
        });
      } else {
        toast.error(`${name} is not working`, { description: result.message });
      }
    } catch (e) {
      toast.error(`Could not test ${name}`, {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      size={compact ? "icon-sm" : "sm"}
      aria-label={`Test ${name}`}
      title="Test the connection (a real call to the app)"
      disabled={busy}
      aria-busy={busy}
      onClick={() => void run()}
    >
      {busy ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />}
      {!compact && "Test connection"}
    </Button>
  );
}
