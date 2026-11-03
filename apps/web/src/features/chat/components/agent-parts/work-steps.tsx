"use client";

import { Markdown } from "@/components/markdown";
import type { MessagePart } from "@/features/chat/lib/protocol";
import { ReasoningStep } from "./reasoning-step";
import { ToolStep } from "./tool-step";

/** The steps of a turn in order: thoughts, tool calls, and the text written between them. */
export function WorkSteps({
  parts,
  streaming,
}: {
  parts: MessagePart[];
  streaming: boolean;
}) {
  const lastIndex = parts.length - 1;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {parts.map((part, i) => {
        const live = streaming && i === lastIndex;
        if (part.type === "text")
          return part.text ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
            <Markdown key={i} isStreaming={live}>
              {part.text}
            </Markdown>
          ) : null;
        if (part.type === "file") return null;
        if (part.type === "reasoning")
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
          return <ReasoningStep key={i} text={part.text} streaming={live} />;
        return (
          <ToolStep key={part.id || i} part={part} streaming={streaming} />
        );
      })}
    </div>
  );
}
