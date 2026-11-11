"use client";

import { Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "../describe";
import { deleteThread, listThreads, type ThreadSummary } from "./api";
import { useAssistant } from "./store";

/** Every assistant chat of the user (across workflows), newest first, 30 at a time. */
export function HistoryList({ workflowId }: { workflowId: string }) {
  const [items, setItems] = useState<ThreadSummary[] | null>(null);
  const [more, setMore] = useState(false);

  const load = async (before?: string) => {
    try {
      const page = (await listThreads(before)).items;
      setItems((old) => (before ? [...(old ?? []), ...page] : page));
      setMore(page.length === 30);
    } catch (e) {
      toast.error((e as Error).message);
      setItems((old) => old ?? []);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: first page once, when the list opens
  useEffect(() => void load(), []);

  const remove = async (id: string) => {
    try {
      await deleteThread(id);
      setItems((all) => all?.filter((t) => t.id !== id) ?? null);
      if (useAssistant.getState().thread?.id === id)
        await useAssistant.getState().newThread(workflowId);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!items) return <Skeleton className="m-3 h-24" />;
  if (items.length === 0)
    return <p className="p-4 text-muted-foreground text-sm">No chats yet.</p>;
  return (
    <ul className="flex flex-col p-1.5">
      {items.map((t) => (
        <li
          key={t.id}
          className="group flex items-center gap-1 rounded-md hover:bg-muted"
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col px-2 py-1.5 text-left"
            onClick={() =>
              void useAssistant.getState().openThread(t.id, workflowId)
            }
          >
            <span className="truncate text-sm">{t.title}</span>
            <span className="truncate text-muted-foreground text-xs">
              {t.workflowName ?? "Deleted workflow"} · {timeAgo(t.updatedAt)}
            </span>
          </button>
          <Button
            size="icon-xs"
            variant="ghost"
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Delete “${t.title}”`}
            onClick={() => void remove(t.id)}
          >
            <Trash2Icon />
          </Button>
        </li>
      ))}
      {more && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load(items.at(-1)?.updatedAt)}
        >
          Show older chats
        </Button>
      )}
    </ul>
  );
}
