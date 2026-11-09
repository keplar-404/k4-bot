import { GraphRecursionError } from "@langchain/langgraph";
import { createDb } from "../../../db";
import type { Env } from "../../../config/env";
import type { AgentBot } from "../../agent/agent";
import type { BotApps } from "../../agent/mcp";
import { DEFAULT_MODEL_ID, isFreeModel } from "../../agent/models";
import type { FileRef, SubagentStatus } from "../../agent/parts";
import { consumeRun } from "../../agent/run-stream";
import { collectUnfinished, GroupHub } from "../../agent/tools/subagents";
import { isMode } from "../modes";
import type { GroupMember } from "../../groups/store";
import { getOwnedThread, tokensUsedToday } from "../threads";
import type { buildRunAgent } from "./agent";
import { prepareAgent } from "./prepare";
import { pauseFor } from "./interrupt";
import { createRecorder } from "./recorder";
import { createUsageReporter } from "./usage-events";
import { publishEvent, stopRequested } from "./relay";
import { agentInput, createSink } from "./sink";
import { classifyProviderError, isTransient } from "./provider-error";
import { type ChatRunParams, type Publish, SLICE_WALL_MS, type SliceResult } from "./types";

/** One durable slice: drives the agent up to RUN_SLICE_STEPS graph steps, then reports how the run goes on. */
export async function runSlice(
  env: Env,
  params: ChatRunParams,
  botRow: AgentBot,
  attached: FileRef[],
  slice: number,
  resume: unknown,
  group?: { groupId: string; members: GroupMember[] },
): Promise<SliceResult> {
  const { runId, threadId, userId } = params;
  // Each member of a group chat keeps its own agent state; the chat itself is shared through the turn's input.
  const checkpointId = params.botId ? `${threadId}:${params.botId}` : threadId;
  const db = createDb(env.DATABASE_URL);
  // Group turns say which bot is working, so the chat can name every event's message from the first token.
  const publish: Publish = (type, payload) => publishEvent(env, threadId, type, { runId, ...(params.botId ? { botId: params.botId } : {}), ...payload });
  const rec = createRecorder(db, params, publish);
  const stub = env.COMPUTER_ENABLED && env.E2B_API_KEY ? env.USER_COMPUTER.get(env.USER_COMPUTER.idFromName(userId)) : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Stop button: polled while the agent works (the stop request comes in on another request).
  let stopped = false;
  let poll: ReturnType<typeof setInterval> | undefined;
  let markStopped: () => void = () => {};
  const stoppedPromise = new Promise<void>((resolve) => (markStopped = resolve));
  let apps: BotApps | undefined;
  // This segment's sub-agent groups. They live only while the segment runs, so they must end before it does.
  const sliceDeadline = Date.now() + SLICE_WALL_MS;
  const hub = new GroupHub();

  /**
   * Stop was pressed: what the run produced so far is saved like any other progress (the message, and the agent's
   * checkpoint for what the model had only streamed, so the next message sees it), and the chat is told it ended.
   */
  async function endStopped(agent?: ReturnType<typeof buildRunAgent>): Promise<SliceResult> {
    clearInterval(poll);
    await rec.flushAll().catch(() => undefined);
    for (const part of rec.acc.parts) if (part.type === "tool" && part.status === "running") part.status = "error";
    await rec.saveProgress().catch(() => undefined);
    const last = rec.acc.parts.at(-1);
    if (agent && last?.type === "text") {
      // The aborted model call never reached the checkpoint: add its partial answer so the conversation stays whole.
      await agent.updateState({ configurable: { thread_id: checkpointId } }, { messages: [{ role: "assistant", content: last.text }] }).catch(() => undefined);
    }
    await publish("run.stopped", { messageId: `${runId}:assistant` });
    return { status: "done" };
  }
  try {
    // The bot was deleted while this run waited or slept: stop quietly (there is no chat left to tell).
    const ownedThread = await getOwnedThread(db, threadId, userId);
    if (!ownedThread) return { status: "failed" };
    const mode = isMode(ownedThread.mode) ? ownedThread.mode : "ask";
    // Stop was pressed between two slices: end here without calling the model.
    if (await stopRequested(env, threadId, runId).catch(() => false)) {
      await publish("run.stopped", { messageId: `${runId}:assistant` });
      return { status: "done" };
    }
    // Its name for /home/BOTS.md. Storage only in the Durable Object: no E2B call.
    await stub?.registerBot(botRow.id, botRow.name).catch(() => undefined);
    const free = isFreeModel(params.modelId ?? DEFAULT_MODEL_ID);
    const todayBase = await tokensUsedToday(db, userId);
    if (!free && todayBase >= env.MAX_DAILY_TOKENS_PER_USER) {
      // `notice`: written by this app for the user, so the chat shows it as is (not as a provider error).
      await publish("run.failed", { error: `Today's token budget (${env.MAX_DAILY_TOKENS_PER_USER}) is used up, so the bot stopped. It resets at 00:00 UTC.`, notice: true });
      return { status: "failed" };
    }

    const progress = new Map<string, SubagentStatus[]>();
    const prepared = await prepareAgent(env, db, { params, bot: botRow, attached, mode, stub, group }, { publish, hub, sliceDeadline, progress });
    const { agent, contextLength } = prepared;
    apps = prepared.apps;
    // A retried slice may carry an answer the failed one already used: only send it while the agent still waits for it.
    if (resume !== undefined && slice > 0) {
      const state = await agent.getState({ configurable: { thread_id: checkpointId } });
      if (!state.tasks?.some((t) => t.interrupts?.length)) resume = undefined;
    }
    if (resume !== undefined) await publish("run.resumed", {});
    const onUsage = createUsageReporter({ db, threadId, publish, contextLength, todayBase, counted: !free, todayLimit: env.MAX_DAILY_TOKENS_PER_USER });
    const sink = createSink(rec, publish, stub, botRow.id, progress, onUsage);
    const config = { version: "v3", configurable: { thread_id: checkpointId }, recursionLimit: env.RUN_SLICE_STEPS, durability: "sync" };
    const stream = await agent.streamEvents(agentInput(params, attached, slice, resume), config);
    timer = setTimeout(() => stream.abort?.(), sliceDeadline - Date.now());
    poll = setInterval(async () => {
      if (stopped || !(await stopRequested(env, threadId, runId).catch(() => false))) return;
      stopped = true;
      stream.abort?.();
      markStopped();
    }, 500);
    let { interrupt } = await consumeRun(stream, sink, rec.acc, stoppedPromise);
    if (stopped) return await endStopped(agent);
    await rec.flushAll();
    await rec.saveProgress();

    // The bot ended its turn while a sub-agent group was still working: wait for the group, then hand its results
    // back to the bot so it can act on them (they would otherwise be lost when this segment ends).
    const results = !interrupt && hub.groups.size > 0 ? await collectUnfinished(hub) : null;
    if (results) {
      const content = `[Automatic message] Your sub-agent group finished after your last reply. Act on its results now.\n\n${results}`;
      ({ interrupt } = await consumeRun(await agent.streamEvents({ messages: [{ role: "user", content }] }, config), sink, rec.acc));
      await rec.flushAll();
      await rec.saveProgress();
    }

    if (interrupt) return pauseFor(interrupt, publish);
    await publish("run.done", { messageId: `${runId}:assistant` });
    return { status: "done" };
  } catch (error) {
    if (stopped) return await endStopped();
    await rec.flushAll().catch(() => undefined);
    await rec.saveProgress().catch(() => undefined);
    // The slice hit its step limit (or its time limit). The checkpoint is intact; carry on in the next slice.
    if (error instanceof GraphRecursionError || (error as Error)?.name === "AbortError") return { status: "continue" };
    console.error("[chat-run] failed", error);
    // The provider let us down for a moment: the workflow waits and runs a new slice from the last checkpoint.
    // `reason`: which limit or failure it was, so the chat can say so (provider-error.ts); `status`: the provider's HTTP status.
    const { reason, status } = classifyProviderError(error);
    const message = error instanceof Error ? error.message : String(error);
    if (isTransient(error)) return { status: "retry", error: message, httpStatus: status, reason };
    await publish("run.failed", { error: message || "agent run failed", status, reason });
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
    clearInterval(poll);
    await apps?.close();
    await rec.saveUsage(params.modelId ?? DEFAULT_MODEL_ID);
    // Hand the mouse and keyboard back so the user's other bots are not blocked between slices.
    await stub?.releaseBot(botRow.id).catch(() => undefined);
  }
}
