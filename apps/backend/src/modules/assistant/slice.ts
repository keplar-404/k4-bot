import { Command, GraphRecursionError } from "@langchain/langgraph";
import type { Env } from "../../config/env";
import { createDb } from "../../db";
import { type AssistantTodo, agentUsage } from "../../db/schema";
import { isFreeModel } from "../agent/models";
import { clip, type Part } from "../agent/parts";
import { consumeRun, type RunSink, type RunStream } from "../agent/run-stream";
import { isTransient } from "../chat/run/provider-error";
import { tokensUsedToday } from "../chat/threads";
import { type AssistantRunParams, buildAssistant, userContent } from "./agent";
import { liveAssistant } from "./live";
import { partsForLive } from "./live-parts";
import { getRunRow, setRun } from "./store";

/** A slice stops well inside a Workflow step's 30 minutes; the next one resumes from the checkpoint. */
const SLICE_WALL_MS = 20 * 60_000;
/** How often a working slice checks whether Stop was pressed. */
const STOP_POLL_MS = 1_500;
/** The open chat gets the growing turn at most this often (text arrives token by token). */
const PUSH_MS = 250;

/** The answer when the model ended without one: says honestly how far it got. */
export const unfinishedNote = (todos: AssistantTodo[]) => {
  const open = todos.filter((t) => t.status !== "completed");
  if (todos.length === 0 || open.length === 0) return "Done. Check the canvas for the changes.";
  return `I stopped before finishing: ${todos.length - open.length} of ${todos.length} steps done. Still open: ${open.map((t) => t.content).join("; ")}. Ask me to continue.`;
};

export type SliceInput = { kind: "message"; content: string; fileIds: string[] } | { kind: "resume"; value: unknown } | { kind: "continue" };

export type SliceResult =
  | { status: "done"; answer: string; todos: AssistantTodo[] }
  | { status: "waiting"; question: Record<string, unknown>; todos: AssistantTodo[] }
  | { status: "continue"; todos: AssistantTodo[] }
  | { status: "stopped"; todos: AssistantTodo[] }
  | { status: "retry"; error: string; todos: AssistantTodo[] }
  | { status: "failed"; error: string; todos: AssistantTodo[] };

type Streamable = {
  streamEvents(input: unknown, config: object): Promise<RunStream & { abort?: () => void }>;
  getState(config: object): Promise<{ values?: { todos?: AssistantTodo[] } }>;
};

/** The model's answer: the text it wrote after its last tool call, or nothing when the turn ended on a tool. */
const answerOf = (parts: Part[]) => {
  const last = parts.at(-1);
  return last?.type === "text" ? last.text.trim() : "";
};

/**
 * One durable slice of an assistant run: drives the agent up to RUN_SLICE_STEPS graph steps and reads its event
 * stream like a bot chat does (reasoning, tool calls, text). The turn so far is saved on the run and pushed to the
 * open builder as it grows, so the chat shows it live and a reopened page picks it up.
 */
export async function runAssistantSlice(env: Env, p: AssistantRunParams, input: SliceInput, todos0: AssistantTodo[]): Promise<SliceResult> {
  const db = createDb(env.DATABASE_URL);
  const live = liveAssistant(env, p.workflowId);
  let todos = todos0;
  const free = isFreeModel(p.modelId ?? "");
  if (!free && (await tokensUsedToday(db, p.userId)) >= env.MAX_DAILY_TOKENS_PER_USER) {
    return { status: "failed", error: `Today's token budget is used up. It resets at 00:00 UTC.`, todos };
  }

  const { agent, model } = await buildAssistant(env, db, p);
  const run = agent as unknown as Streamable;
  const config = { version: "v3", configurable: { thread_id: `assistant:${p.threadId}` }, recursionLimit: env.RUN_SLICE_STEPS, durability: "sync" };
  const agentInput =
    input.kind === "message"
      ? { messages: [{ role: "user", content: await userContent(env, db, p.userId, input.content, input.fileIds, p.modelId) }] }
      : input.kind === "resume"
        ? new Command({ resume: input.value })
        : null;

  // What earlier slices of this turn already produced; this slice adds to it.
  const base: Part[] = (await getRunRow(db, p.runId))?.parts ?? [];
  const acc = { parts: [] as Part[], usage: { input: 0, output: 0 } };
  // Text and reasoning of the model message being written now (they join `acc` when that message ends).
  let writing = { text: "", reasoning: "" };
  const turn = (): Part[] => [
    ...base,
    ...acc.parts,
    ...(writing.reasoning ? [{ type: "reasoning" as const, text: writing.reasoning }] : []),
    ...(writing.text ? [{ type: "text" as const, text: writing.text }] : []),
  ];

  let timer: ReturnType<typeof setTimeout> | undefined;
  const push = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      void live.parts({ runId: p.runId, threadId: p.threadId, parts: partsForLive(turn()) });
    }, PUSH_MS);
  };
  const save = () =>
    setRun(db, p.runId, {
      parts: [...base, ...acc.parts].map((x) => (x.type === "tool" ? { ...x, input: clip(x.input), output: x.output && clip(x.output) } : x)),
    });

  const sink: RunSink = {
    text: (d) => {
      writing.text += d;
      push();
    },
    reasoning: (d) => {
      writing.reasoning += d;
      push();
    },
    toolStart: push,
    toolEnd: push,
    // A model message ended or a tool finished: what is in `acc` is final, so it is saved.
    partsChanged: async () => {
      writing = { text: "", reasoning: "" };
      push();
      await save().catch((e: unknown) => console.error("[assistant] progress not saved", e));
    },
    usage: ({ input: i, output: o }) => {
      acc.usage.input += i;
      acc.usage.output += o;
    },
  };

  let stopped = false;
  let timedOut = false;
  let markStopped: () => void = () => {};
  const stoppedPromise = new Promise<void>((resolve) => (markStopped = resolve));
  let poll: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;

  try {
    const stream = await run.streamEvents(agentInput, config);
    deadline = setTimeout(() => {
      timedOut = true;
      stream.abort?.();
    }, SLICE_WALL_MS);
    poll = setInterval(async () => {
      if (stopped || (await getRunRow(db, p.runId).catch(() => null))?.status !== "cancelled") return;
      stopped = true;
      stream.abort?.();
      markStopped();
    }, STOP_POLL_MS);

    const { interrupt } = await consumeRun(stream, sink, acc, stoppedPromise);
    await save();
    todos = (await run.getState(config).catch(() => null))?.values?.todos ?? todos;
    if (stopped) return { status: "stopped", todos };
    if (timedOut) return { status: "continue", todos };
    if (interrupt) {
      const q = (interrupt.payload ?? {}) as Record<string, unknown>;
      return { status: "waiting", question: Object.keys(q).length ? q : { kind: "confirm", question: "Continue?" }, todos };
    }
    return { status: "done", answer: answerOf(acc.parts) || unfinishedNote(todos), todos };
  } catch (error) {
    await save().catch(() => undefined);
    if (stopped) return { status: "stopped", todos };
    // The step limit or the slice's time is up: the checkpoint is intact, the next slice carries on.
    if (error instanceof GraphRecursionError || (error as Error)?.name === "AbortError" || timedOut) return { status: "continue", todos };
    const message = error instanceof Error ? error.message : String(error);
    console.error("[assistant] slice failed", message);
    if (isTransient(error)) return { status: "retry", error: message, todos };
    return { status: "failed", error: message.slice(0, 500), todos };
  } finally {
    clearTimeout(deadline);
    clearInterval(poll);
    clearTimeout(timer);
    // The last state of the turn reaches the open chat even if the throttle had not fired yet.
    await live.parts({ runId: p.runId, threadId: p.threadId, parts: partsForLive([...base, ...acc.parts]) }).catch(() => undefined);
    if (acc.usage.input + acc.usage.output > 0) {
      // Counts toward the user's daily token budget, like a bot chat.
      await db
        .insert(agentUsage)
        .values({ userId: p.userId, runId: `assistant:${p.runId}`, model: model.id, inputTokens: acc.usage.input, outputTokens: acc.usage.output })
        .catch((e: unknown) => console.error("[assistant] usage not recorded", e));
    }
  }
}
