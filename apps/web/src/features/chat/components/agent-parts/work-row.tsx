"use client";

import { useEffect, useState } from "react";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import type { MessagePart } from "@/features/chat/lib/protocol";
import { WorkSteps } from "./work-steps";
import { currentActivity, workSummary } from "./work-summary";

/**
 * Every step of the turn behind one row. While the agent works it is open and its title shimmers with the current
 * activity; once the answer starts it closes by itself (the user can open it again). Nothing is removed.
 */
export function WorkRow({
  work,
  working,
  streaming,
}: {
  work: MessagePart[];
  /** Still working: no final answer yet. */
  working: boolean;
  streaming: boolean;
}) {
  const [open, setOpen] = useState(working);
  useEffect(() => setOpen(working), [working]);
  const steps = work.filter((p) => p.type === "tool").length;
  const title = working
    ? currentActivity(work)
    : `${workSummary(work)}${steps > 1 ? ` · ${steps} steps` : ""}`;

  return (
    <Trace>
      <TraceCollapsible open={open} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status={working ? "running" : undefined}>
            <TraceTitle>{title}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <WorkSteps parts={work} streaming={streaming} />
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
