"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBots } from "@/features/bots/hooks/use-bots";
import { request } from "@/features/chat/lib/client/http";
import type { Connection } from "../api";

/**
 * Sign in to an app on a bot's computer: its browser opens the site in that account's own profile, then you take
 * control on the computer page and log in once. The bot uses that login from then on; disconnecting deletes it.
 */
export function BotLoginDialog({
  appName,
  connections,
  open,
  onOpenChange,
}: {
  appName: string;
  connections: Connection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { bots } = useBots();
  const [botId, setBotId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const active = connections.filter((c) => c.status === "ACTIVE");
  useEffect(() => {
    if (!open) return;
    setBotId(bots[0]?.id ?? "");
    setAccountId(active[0]?.id ?? "");
    setUrl(`https://www.${active[0]?.toolkit ?? "example"}.com`);
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens
  }, [open]);

  async function openIt() {
    setBusy(true);
    try {
      await request("/api/v1/computer/app-login", {
        method: "POST",
        body: JSON.stringify({ botId, accountId, url }),
      });
      toast.success("Opened on the computer. Take control and sign in.");
      onOpenChange(false);
      router.push("/dashboard/vm");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open it.");
    } finally {
      setBusy(false);
    }
  }

  const label = (c: Connection) => c.account ?? c.id;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log in to {appName} on a bot&apos;s computer</DialogTitle>
          <DialogDescription>
            The bot&apos;s browser opens the site in this account&apos;s own
            profile. Take control on the computer page and sign in once; the
            bot then stays signed in. Disconnecting the app deletes that login.
            Turning the computer on uses your computer time.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-bot">Bot</Label>
            <Select value={botId} onValueChange={(v) => setBotId(v ?? "")}>
              <SelectTrigger id="login-bot" className="w-full">
                <SelectValue placeholder="Choose a bot">{bots.find((b) => b.id === botId)?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {bots.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {active.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-account">Account</Label>
              <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "")}>
                <SelectTrigger id="login-account" className="w-full">
                  <SelectValue>{label(active.find((c) => c.id === accountId) ?? active[0]!)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {active.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {label(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-url">Website</Label>
            <Input id="login-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={busy || !botId || !accountId || !/^https:\/\//.test(url)} onClick={() => void openIt()}>
            {busy && <Loader2Icon className="animate-spin" />}
            Open on the computer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
