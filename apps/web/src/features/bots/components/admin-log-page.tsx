"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { request } from "@/features/chat/lib/client/http";

type Entry = {
  id: string;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

/** "delete_bot" → "Deleted a bot": what each logged action means, in words. */
const WORDS: Record<string, string> = {
  create_bot: "Created a bot",
  update_bot: "Changed a bot",
  delete_bot: "Deleted a bot",
  set_bot_memory: "Replaced a bot's memory",
  create_group: "Created a group",
  update_group: "Changed a group",
  delete_group: "Deleted a group",
  message_bot: "Sent a bot a message",
  run_as_bot: "Ran a command in a bot's folder",
};

/** The detail worth showing: names and the command, never ids alone. */
function summary(detail: Entry["detail"]) {
  if (!detail) return "";
  const parts = ["name", "newName", "command", "exitCode"]
    .filter((k) => detail[k] !== undefined && detail[k] !== null)
    .map((k) => (k === "exitCode" ? `exit ${detail[k]}` : String(detail[k])));
  return parts.join(" · ");
}

/** The admin bot's change log, reloaded each time the page opens. */
const useAdminLog = create<{
  items: Entry[] | null;
  error: string | null;
  load: () => Promise<void>;
}>()((set) => ({
  items: null,
  error: null,
  load: () =>
    request<{ items: Entry[] }>("/api/v1/bots/admin/audit").then(
      (r) => set({ items: r.items, error: null }),
      (e: Error) => set({ error: e.message }),
    ),
}));

/** Everything the admin bot changed (kept 90 days), so the user can check its work. */
export function AdminLogPage() {
  const items = useAdminLog((s) => s.items);
  const error = useAdminLog((s) => s.error);
  const load = useAdminLog((s) => s.load);
  useEffect(() => void load(), [load]);
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader title="Admin bot activity" />
      <p className="max-w-xl text-muted-foreground text-sm">
        Every change your admin bot made to your other bots, groups and their
        files, newest first. Kept for 90 days.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {!items && !error && <Skeleton className="h-32 w-full max-w-2xl" />}
      {items?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nothing yet. Ask the admin bot to manage your bots and it shows here.
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="flex max-w-2xl flex-col divide-y rounded-lg border">
          {items.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 px-3 py-2">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">
                  {WORDS[e.action] ?? e.action}
                </span>
                <time
                  className="shrink-0 text-muted-foreground text-xs"
                  dateTime={e.createdAt}
                >
                  {new Date(e.createdAt).toLocaleString()}
                </time>
              </span>
              {summary(e.detail) && (
                <span className="truncate font-mono text-muted-foreground text-xs">
                  {summary(e.detail)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
