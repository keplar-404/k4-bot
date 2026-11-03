"use client";

import { Markdown } from "@/components/markdown";
import type { MessagePart } from "@/features/chat/lib/protocol";
import { FileList } from "@/features/files/components/file-list";
import { splitParts } from "./split";
import { TodoList, todosOf } from "./todo-list";
import { WorkRow } from "./work-row";

/**
 * An assistant turn: one collapsible row with all of its work, then the final answer and the files the tools
 * produced (download cards). While the run is live, every text stays in the row: text the model writes between
 * steps is not the answer, and only the run's end says which text was the last. The work is kept, only folded.
 */
export function AgentParts({
  parts,
  streaming,
}: {
  parts: MessagePart[];
  streaming: boolean;
}) {
  const split = splitParts(parts);
  const work = streaming ? parts.filter((p) => p.type !== "file") : split.work;
  const answer = streaming ? [] : split.answer;
  const plan = [...work]
    .reverse()
    .find((p) => p.type === "tool" && p.name === "write_todos");
  const todos = streaming && plan?.type === "tool" ? todosOf(plan) : null;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {work.length > 0 && (
        <WorkRow work={work} working={streaming} streaming={streaming} />
      )}
      {/* While working, the current plan stays in view even if the row is folded. */}
      {todos && <TodoList todos={todos} />}
      {answer.map((part, i) =>
        part.type === "text" && part.text ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
          <Markdown key={i}>{part.text}</Markdown>
        ) : null,
      )}
      {split.files.length > 0 && <FileList files={split.files} />}
    </div>
  );
}
