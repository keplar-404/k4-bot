"use client";

import { Trash2Icon, UserIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteBotDialog } from "@/features/bots/components/delete-bot-dialog";
import { useBots } from "@/features/bots/hooks/use-bots";
import { useDeleteBot } from "@/features/bots/hooks/use-delete-bot";
import { type ComputerAccount, listAccounts } from "@/features/computer/api";

const size = (kb: number | null) =>
  kb === null
    ? "—"
    : kb >= 1024 * 1024
      ? `${(kb / 1024 / 1024).toFixed(1)} GB`
      : kb >= 1024
        ? `${Math.round(kb / 1024)} MB`
        : `${kb} KB`;

/**
 * The accounts on the computer: one Linux user per bot, each with a private home folder only that bot can use.
 * Deleting an account deletes its bot (a bot cannot work without its account), so it asks first, loudly.
 */
export function VmAccounts({ running }: { running: boolean }) {
  const { bots, deleteBot } = useBots();
  const [data, setData] = useState<{
    running: boolean;
    items: ComputerAccount[];
    orphans: Array<{ user: string; kb: number }>;
  } | null>(null);
  const load = useCallback(
    () => listAccounts().then(setData, () => setData(null)),
    [],
  );
  // Sizes are only known while the computer runs: reload when it wakes or sleeps.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `running` is the reason to reload, not an input
  useEffect(() => void load(), [load, running]);
  const del = useDeleteBot(bots, async (id) => {
    await deleteBot(id);
    await load();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>
          {data?.items.length ?? 0} bot account
          {data?.items.length === 1 ? "" : "s"} on this computer. Each bot has
          its own Linux user and a private home folder.{" "}
          {data && !data.running && "Wake the computer to see folder sizes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {data?.items.map((a) => (
          <div
            key={a.botId}
            className="flex items-center gap-3 rounded-lg border px-3 py-2"
          >
            <UserIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{a.botName}</p>
              <p className="truncate font-mono text-muted-foreground text-xs">
                {a.user} · {a.home}
                {a.exists === false && " · not created yet (made on first use)"}
              </p>
            </div>
            <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
              {size(a.kb)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => del.handleDelete(a.botId)}
              aria-label={`Delete ${a.botName} and its account`}
            >
              <Trash2Icon />
              Delete
            </Button>
          </div>
        ))}
        {data?.orphans.map((o) => (
          <p key={o.user} className="text-muted-foreground text-xs">
            {o.user} ({size(o.kb)}) belongs to a deleted bot and is removed the
            next time the computer starts.
          </p>
        ))}
        {data?.items.length === 0 && (
          <p className="text-muted-foreground text-sm">No bots yet.</p>
        )}
      </CardContent>
      <DeleteBotDialog
        bot={del.confirming}
        deleting={del.deleting}
        onCancel={() => del.setConfirming(null)}
        onConfirm={() => void del.confirmDelete()}
      />
    </Card>
  );
}
