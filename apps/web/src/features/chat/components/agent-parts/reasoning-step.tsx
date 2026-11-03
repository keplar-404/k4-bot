"use client";

import { BrainIcon } from "lucide-react";
import { Markdown } from "@/components/markdown";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

export function ReasoningStep({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status={streaming ? "running" : undefined}>
            <TraceIcon>
              <BrainIcon />
            </TraceIcon>
            <TraceTitle>{streaming ? "Thinking" : "Thought"}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <div className="text-sm text-muted-foreground">
            <Markdown isStreaming={streaming}>{text}</Markdown>
          </div>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
