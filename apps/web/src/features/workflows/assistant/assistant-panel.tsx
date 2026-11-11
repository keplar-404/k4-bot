"use client";

import {
  ArrowLeftIcon,
  GripVerticalIcon,
  HistoryIcon,
  Loader2Icon,
  SparklesIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentParts } from "@/features/chat/components/agent-parts";
import { isWorking } from "./api";
import { Composer } from "./composer";
import { HistoryList } from "./history-list";
import { QuestionCard } from "./question-card";
import { useAssistant } from "./store";
import { ThreadTitle } from "./thread-title";
import { useDrag } from "./use-drag";

const SIZE = { width: 380, height: 560 };
/** The page's socket brings progress for this workflow; a run on another workflow is read every few seconds. */
const POLL_MS = 4000;

const EXAMPLES = [
  "Fetch my last 10 Gmail emails and summarise each one",
  "When a Stripe payment fails, post it to Slack #billing",
  "Fix the issues on this workflow",
];

/**
 * The workflow assistant: a small chat window over the builder, dragged by its grip. It works in the cloud, so a
 * closed tab misses nothing: reopening shows its answer, or what it is doing now.
 */
export function AssistantPanel({ workflowId }: { workflowId: string }) {
  const open = useAssistant((s) => s.open);
  const view = useAssistant((s) => s.view);
  const thread = useAssistant((s) => s.thread);
  const messages = useAssistant((s) => s.messages);
  const run = useAssistant((s) => s.run);
  const loading = useAssistant((s) => s.loading);
  const error = useAssistant((s) => s.error);
  const [example, setExample] = useState<string>();
  const drag = useDrag(SIZE);
  const panel = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const working = isWorking(run?.status);

  useEffect(() => {
    if (open && !thread)
      void useAssistant.getState().openThread(null, workflowId);
  }, [open, thread, workflowId]);

  useEffect(() => {
    // The page's socket already streams this workflow's run; polling is only the fallback for a run on
    // another workflow (its events go to that workflow's channel).
    const elsewhere = working && run?.workflowId && run.workflowId !== workflowId;
    if (!open || !elsewhere) return;
    const timer = setInterval(() => {
      if (!document.hidden) void useAssistant.getState().refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [open, working, run?.workflowId, workflowId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new content only
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, run?.todos, run?.status]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) =>
      e.key === "Escape" && useAssistant.getState().setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!open) return null;
  const style = drag.pos
    ? {
        left: drag.pos.x,
        top: drag.pos.y,
        width: SIZE.width,
        height: SIZE.height,
      }
    : { right: 16, bottom: 16, width: SIZE.width, height: SIZE.height };

  return (
    <div
      ref={panel}
      data-assistant-panel
      role="dialog"
      aria-label="Workflow assistant"
      style={style}
      className="fixed z-40 flex max-h-[calc(100svh-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl"
    >
      <header className="flex items-center gap-1 border-b px-1.5 py-1.5">
        <button
          type="button"
          aria-label="Move the assistant (or use the arrow keys)"
          title="Drag to move · double-click to reset"
          className="flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          onPointerDown={drag.onPointerDown}
          onDoubleClick={drag.reset}
          onKeyDown={(e) => {
            const r = panel.current?.getBoundingClientRect();
            if (!r) return;
            const step: Record<string, [number, number]> = {
              ArrowLeft: [-10, 0],
              ArrowRight: [10, 0],
              ArrowUp: [0, -10],
              ArrowDown: [0, 10],
            };
            const move = step[e.key];
            if (move) {
              e.preventDefault();
              drag.nudge(move[0], move[1], r);
            }
          }}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        {view === "history" ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Back to the chat"
            onClick={() => useAssistant.getState().setView("chat")}
          >
            <ArrowLeftIcon />
          </Button>
        ) : (
          <SparklesIcon className="ml-1 size-4 shrink-0 text-primary" />
        )}
        {view === "history" ? (
          <span className="min-w-0 flex-1 truncate px-1 font-medium text-sm">
            Chats
          </span>
        ) : (
          <ThreadTitle />
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Chat history"
          title="History"
          onClick={() => useAssistant.getState().setView("history")}
        >
          <HistoryIcon />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="New chat"
          title="New chat"
          disabled={working}
          onClick={() => void useAssistant.getState().newThread(workflowId)}
        >
          <SquarePenIcon />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Close the assistant"
          onClick={() => useAssistant.getState().setOpen(false)}
        >
          <XIcon />
        </Button>
      </header>

      {view === "history" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <HistoryList workflowId={workflowId} />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3">
            {loading && <Skeleton className="h-16" />}
            {error && <p className="text-destructive text-sm">{error}</p>}
            {!loading && messages.length === 0 && !working && (
              <div className="flex flex-col gap-2 pt-6 text-center">
                <SparklesIcon className="mx-auto size-6 text-primary" />
                <p className="font-medium text-sm">
                  What should this workflow do?
                </p>
                <p className="text-muted-foreground text-xs">
                  I build it on the canvas while you watch.
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {EXAMPLES.map((e) => (
                    <Button
                      key={e}
                      variant="outline"
                      size="sm"
                      className="h-auto whitespace-normal py-1.5 text-left text-xs"
                      onClick={() => setExample(e)}
                    >
                      {e}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <ol className="flex min-w-0 flex-col gap-3">
              {messages.map((m) =>
                m.role === "user" ? (
                  <li
                    key={m.id}
                    className="ml-8 min-w-0 max-w-[90%] self-end rounded-xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground text-sm"
                  >
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {m.content}
                    </p>
                    {m.files.length > 0 && (
                      <p className="mt-1 text-xs opacity-80">
                        📎 {m.files.map((f) => f.name).join(", ")}
                      </p>
                    )}
                  </li>
                ) : (
                  <li
                    key={m.id}
                    className="mr-4 flex min-w-0 flex-col gap-2 text-sm"
                  >
                    {/* The same turn view as a bot chat: the work folded in one row, then the answer. */}
                    {m.parts.length > 0 ? (
                      <AgentParts parts={m.parts} streaming={false} />
                    ) : (
                      <div className="prose-sm min-w-0 break-words">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    )}
                  </li>
                ),
              )}
              {run && working && (
                <li className="mr-4 flex min-w-0 flex-col gap-2">
                  {/* Live: reasoning, tool calls and text as they happen, like the chat page. */}
                  {run.parts.length > 0 ? (
                    <AgentParts parts={run.parts} streaming />
                  ) : (
                    run.status !== "waiting" && (
                      <p className="flex items-center gap-2 text-muted-foreground text-xs">
                        <Loader2Icon className="size-3.5 animate-spin" />
                        Thinking…
                      </p>
                    )
                  )}
                  {run.status === "waiting" && <QuestionCard run={run} />}
                  {run.workflowId !== workflowId && (
                    <p className="text-muted-foreground text-xs">
                      Working on another workflow. Open it to watch.
                    </p>
                  )}
                </li>
              )}
            </ol>
            <div ref={bottom} />
          </div>
          <Composer workflowId={workflowId} prompt={example} />
        </>
      )}
    </div>
  );
}
