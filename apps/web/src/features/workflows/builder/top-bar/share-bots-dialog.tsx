"use client";

import { BotIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBots } from "@/features/bots/hooks/use-bots";
import { getSharedBots, setSharedBots } from "../../api";
import { useBuilder } from "../store";

/** Which of the user's bots may see and run this workflow. A bot always keeps the workflows it made itself. */
export function ShareBotsDialog() {
  const id = useBuilder((s) => s.workflow?.id);
  const { bots } = useBots();
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState<string[] | null>(null);

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share with bots</DialogTitle>
            <DialogDescription>
              A bot can run this workflow when it is on and started by hand.
              Bots ask you first unless you chose Allow all in the chat.
            </DialogDescription>
          </DialogHeader>
          {bots.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              You have no bots yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {bots.map((b) => (
                <li key={b.id}>
                  <label className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      disabled={!shared}
                      checked={shared?.includes(b.id) ?? false}
                      onChange={() => void toggle(b.id)}
                    />
                    {b.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
