"use client";

import { CheckIcon, CircleDashedIcon, Loader2Icon } from "lucide-react";
import type { MessagePart } from "@/features/chat/lib/protocol";
import { cn } from "@/lib/utils";

type Todo = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

/** The plan from a write_todos call (the agent rewrites the whole list each time). Null when it cannot be read. */
export function todosOf(
  part: Extract<MessagePart, { type: "tool" }>,
): Todo[] | null {
  try {
    const todos = (JSON.parse(part.input) as { todos?: Todo[] }).todos;
    return Array.isArray(todos)
      ? todos.filter((t) => typeof t?.content === "string")
      : null;
  } catch {
    // The input was clipped on the server: the text form in the step's details still shows it.
    return null;
  }
}

/** The latest plan of the turn: what the agent is going to do, what it is on, what is done. */
export function TodoList({ todos }: { todos: Todo[] }) {
  const done = todos.filter((t) => t.status === "completed").length;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <p className="text-muted-foreground">
        Plan · {done} of {todos.length} done
      </p>
      <ul className="flex flex-col gap-1">
        {todos.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the agent rewrites the list as a whole
          <li key={i} className="flex items-start gap-1.5">
            {t.status === "completed" ? (
              <CheckIcon className="mt-0.5 size-3 shrink-0" />
            ) : t.status === "in_progress" ? (
              <Loader2Icon className="mt-0.5 size-3 shrink-0 animate-spin" />
            ) : (
              <CircleDashedIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
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
    </div>
  );
}
