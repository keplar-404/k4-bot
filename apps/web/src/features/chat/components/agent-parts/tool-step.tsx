"use client";

import { CircleAlertIcon } from "lucide-react";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import type { MessagePart } from "@/features/chat/lib/protocol";
import { describe } from "./describe";
import { Output } from "./output";
import { prettyInput } from "./pretty-input";
import { SubagentList } from "./subagent-list";
import { TodoList, todosOf } from "./todo-list";

type ToolPart = Extract<MessagePart, { type: "tool" }>;

export function ToolStep({
  part,
  streaming,
}: {
  part: ToolPart;
  streaming: boolean;
}) {
  const running = part.status === "running" && streaming;
  const stopped = part.status === "running" && !streaming;
  const failed = part.status === "error" || stopped;
  const { icon, title } = describe(part, !running);
  const hasDetail = Boolean(part.input || part.output);
  // Files are shown with the final answer; the sub-agent list stays here (live, then as saved at the end).
  const todos = part.name === "write_todos" ? todosOf(part) : null;
  const files = part.agents?.length ? (
    <SubagentList agents={part.agents} />
  ) : todos ? (
    <TodoList todos={todos} />
  ) : null;

  const line = (
    <TraceLine status={running ? "running" : failed ? "error" : undefined}>
      <TraceIcon>{failed ? <CircleAlertIcon /> : icon}</TraceIcon>
      <TraceTitle>
        {failed && !stopped
          ? `Failed: ${title}`
          : stopped
            ? `Stopped: ${title}`
            : title}
      </TraceTitle>
    </TraceLine>
  );
  if (!hasDetail)
    return (
      <>
        <Trace>{line}</Trace>
        {files}
      </>
    );

  return (
    <>
      <Trace>
        <TraceCollapsible>
          <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <div className="flex flex-col gap-3">
              {part.name !== "ask_user" && part.name !== "wait_for" && (
                <Output label="Input" text={prettyInput(part)} />
              )}
              <Output
                label={failed ? "Error" : "Result"}
                text={part.output ?? ""}
              />
            </div>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
      {files}
    </>
  );
}
