"use client";

import { Markdown } from "@/components/markdown";
import type { MessagePart } from "@/features/chat/lib/protocol";
import { FileList } from "@/features/files/components/file-list";
import { splitParts } from "./split";
import { WorkRow } from "./work-row";

/**
 * An assistant turn: one collapsible row with all of its work, then the final answer and, once the turn has
 * finished, the files the tools produced (download cards in a grid). While the run is live, every text stays in the row: text the model writes between
 * steps is not the answer, and only the run's end says which text was the last. The work is kept, only folded.
 */
export function AgentParts({
  parts,
  streaming,
  who,
}: {
  parts: MessagePart[];
  streaming: boolean;
  /** Group chats: the bot that wrote this turn (named on its folded work row). */
  who?: string;
}) {
  const split = splitParts(parts);
  const work = streaming ? parts.filter((p) => p.type !== "file") : split.work;
  const answer = streaming ? [] : split.answer;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {work.length > 0 && (
        <WorkRow
          work={work}
          working={streaming}
          streaming={streaming}
          who={who}
        />
      )}
      {answer.map((part, i) =>
        part.type === "text" && part.text ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
          <Markdown key={i}>{part.text}</Markdown>
        ) : null,
      )}
      {/* Files appear once the whole turn is done, under the answer: mid-run they would jump around the work. */}
      {!streaming && split.files.length > 0 && <FileList files={split.files} />}
    </div>
  );
}
