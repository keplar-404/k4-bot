"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  ListTodoIcon,
  Loader2Icon,
} from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ChatMessageView } from "@/features/chat/lib/protocol";
import { cn } from "@/lib/utils";
import { isPlanTool, todosOf } from "../agent-parts/todo-list";

/** The latest plan (write_todos) of the last answer, or null when it has none. */
function latestTodos(messages: ChatMessageView[]) {
  const last = messages.at(-1);
  if (last?.role !== "assistant" || !last.parts) return null;
  const plan = [...last.parts]
    .reverse()
    .find((p) => p.type === "tool" && isPlanTool(p.name));
  return plan?.type === "tool" ? todosOf(plan) : null;
}

/**
 * The bot's to-do list, docked above the prompt bar while it works (and while anything is left undone): a header
 * with the counts, and the items in a panel that slides open and closed.
 */
export function TodoPanel({
  messages,
  working,
}: {
  messages: ChatMessageView[];
  working: boolean;
}) {
  const [open, setOpen] = useState(false);
  const todos = latestTodos(messages);
  if (!todos?.length) return null;
  const doing = todos.filter((t) => t.status === "in_progress").length;
  const pending = todos.filter((t) => t.status === "pending").length;
  if (!working && doing + pending === 0) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mx-auto w-full max-w-3xl rounded-xl border bg-card shadow-xs"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
        <ListTodoIcon className="size-4 text-muted-foreground" />
        <span className="font-medium">To-dos</span>
        <span className="text-muted-foreground text-xs">
          {doing} in progress · {pending} pending
        </span>
        <ChevronDownIcon
          className={cn(
            "ml-auto size-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
        <ul className="flex flex-col gap-1.5 px-3 pb-3">
          {todos.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the agent rewrites the whole list each time
            <li key={i} className="flex items-start gap-2 text-sm">
              {t.status === "completed" ? (
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              ) : t.status === "in_progress" ? (
                <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <CircleIcon className="mt-1 size-2.5 shrink-0 fill-current text-muted-foreground" />
              )}
              <span
                className={cn(
                  t.status === "completed" &&
                    "text-muted-foreground line-through",
                )}
              >
                {t.content}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
