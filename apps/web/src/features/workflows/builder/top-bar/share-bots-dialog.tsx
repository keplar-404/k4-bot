"use client";

import { BotIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBots } from "@/features/bots/hooks/use-bots";
import { getSharedBots, setSharedBots } from "../../api";
import { useBuilder } from "../store";
import { ShareBotRow } from "./share-bot-row";

/** Which of the user's bots may see and run this workflow. A bot always keeps the workflows it made itself. */
export function ShareBotsDialog() {
  const id = useBuilder((s) => s.workflow?.id);
  const { bots } = useBots();
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = bots.filter((b) => !q || b.name.toLowerCase().includes(q));

  useEffect(() => {
    if (!open || !id) return;
    setShared(null);
    getSharedBots(id).then(
      (r) => setShared(r.botIds),
      (e: Error) => toast.error(e.message),
    );
  }, [open, id]);

  async function toggle(botId: string) {
    if (!id || !shared) return;
    const next = shared.includes(botId)
      ? shared.filter((b) => b !== botId)
      : [...shared, botId];
    setShared(next);
    try {
      setShared((await setSharedBots(id, next)).botIds);
    } catch (e) {
      toast.error((e as Error).message);
      setShared(shared);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BotIcon />
        Bots
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share with bots</DialogTitle>
            <DialogDescription>
              Shared bots can read this workflow and run it (when it is on and
              started by hand). Only the bot that made a workflow can change it
              or turn it on or off.
            </DialogDescription>
          </DialogHeader>
          {bots.length > 6 && (
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bots"
              aria-label="Search bots"
            />
          )}
          {bots.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              You have no bots yet. Create one from the sidebar.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {shown.map((b) => (
                <ShareBotRow
                  key={b.id}
                  bot={b}
                  shared={shared?.includes(b.id) ?? false}
                  disabled={!shared}
                  onToggle={() => void toggle(b.id)}
                />
              ))}
            </ul>
          )}
          <DialogFooter>
            <span className="mr-auto self-center text-muted-foreground text-xs">
              {shared
                ? `${shared.length} of ${bots.length} shared`
                : "Loading…"}
            </span>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
