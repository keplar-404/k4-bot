import { GraphRecursionError } from "@langchain/langgraph";
import { createDb } from "../../../db";
import type { Env } from "../../../config/env";
import type { AgentBot } from "../../agent/agent";
import { connectBotApps, type BotApps } from "../../agent/mcp";
import { contextLengthOf } from "../../agent/model-context";
import { DEFAULT_MODEL_ID } from "../../agent/models";
import type { FileRef, SubagentStatus } from "../../agent/parts";
import { consumeRun } from "../../agent/run-stream";
import { collectUnfinished, GroupHub } from "../../agent/tools/subagents";
import { loadBotSkills } from "../../integrations/skills";
import { getOwnedThread, tokensUsedToday } from "../threads";
import { buildRunAgent } from "./agent";
import { attachedImages, peersOf, subagentContext } from "./context";
import { pauseFor } from "./interrupt";
import { createRecorder } from "./recorder";
import { createUsageReporter } from "./usage-events";
import { publishEvent } from "./relay";
import { agentInput, createSink } from "./sink";
import { type ChatRunParams, type Publish, SLICE_WALL_MS, type SliceResult } from "./types";

/** One durable slice: drives the agent up to RUN_SLICE_STEPS graph steps, then reports how the run goes on. */
export async function runSlice(env: Env, params: ChatRunParams, botRow: AgentBot, attached: FileRef[], slice: number, resume: unknown): Promise<SliceResult> {
  const { runId, threadId, userId } = params;
  const db = createDb(env.DATABASE_URL);
  const publish: Publish = (type, payload) => publishEvent(env, threadId, type, { runId, ...payload });
  const rec = createRecorder(db, params, publish);
  const stub = env.COMPUTER_ENABLED && env.E2B_API_KEY ? env.USER_COMPUTER.get(env.USER_COMPUTER.idFromName(userId)) : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let apps: BotApps | undefined;
  // This segment's sub-agent groups. They live only while the segment runs, so they must end before it does.
  const sliceDeadline = Date.now() + SLICE_WALL_MS;
  const hub = new GroupHub();

  try {
    // The bot was deleted while this run waited or slept: stop quietly (there is no chat left to tell).
    if (!(await getOwnedThread(db, threadId, userId))) return { status: "failed" };
    // Its name for /home/BOTS.md. Storage only in the Durable Object: no E2B call.
    await stub?.registerBot(botRow.id, botRow.name).catch(() => undefined);
    const todayBase = await tokensUsedToday(db, userId);
    if (todayBase >= env.MAX_DAILY_TOKENS_PER_USER) {
      await publish("run.failed", { error: `Daily token budget of ${env.MAX_DAILY_TOKENS_PER_USER} reached. It resets at 00:00 UTC.` });
      return { status: "failed" };
    }

    const peers = stub ? await peersOf(db, userId, botRow.id) : [];
    const images = await attachedImages(env, db, params, attached);
    // The bot's skills (read from R2) and connected apps (MCP servers; tokens decrypted here, for this slice only).
    const skills = env.FILES ? await loadBotSkills(env.FILES, db, userId, botRow.id) : {};
    apps = await connectBotApps(env, db, userId, botRow.id);
    const progress = new Map<string, SubagentStatus[]>();
    const subagents = botRow.subagentsEnabled ? await subagentContext(env, db, params, { publish, hub, sliceDeadline, progress }) : undefined;
    // The model's real context window: sizes the automatic summary and the chat's context meter.
    const contextLength = await contextLengthOf(params.modelId ?? DEFAULT_MODEL_ID);
    const agent = buildRunAgent(env, db, params, { bot: botRow, skills, apps, subagents, peers, stub, images, contextLength });

    if (resume !== undefined) await publish("run.resumed", {});
    const onUsage = createUsageReporter({ db, threadId, publish, contextLength, todayBase, todayLimit: env.MAX_DAILY_TOKENS_PER_USER });
    const sink = createSink(rec, publish, stub, botRow.id, progress, onUsage);
    const config = { version: "v3", configurable: { thread_id: threadId }, recursionLimit: env.RUN_SLICE_STEPS, durability: "sync" };
    const stream = await agent.streamEvents(agentInput(params, attached, slice, resume), config);
    timer = setTimeout(() => stream.abort?.(), sliceDeadline - Date.now());
    let { interrupt } = await consumeRun(stream, sink, rec.acc);
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
    await rec.flushAll().catch(() => undefined);
    await rec.saveProgress().catch(() => undefined);
    // The slice hit its step limit (or its time limit). The checkpoint is intact; carry on in the next slice.
    if (error instanceof GraphRecursionError || (error as Error)?.name === "AbortError") return { status: "continue" };
    console.error("[chat-run] failed", error);
    // `status`: HTTP status of the model provider, when the failure came from it.
    await publish("run.failed", { error: error instanceof Error ? error.message : "agent run failed", status: (error as { status?: number }).status });
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
    await apps?.close();
    await rec.saveUsage(params.modelId ?? DEFAULT_MODEL_ID);
    // Hand the mouse and keyboard back so the user's other bots are not blocked between slices.
    await stub?.releaseBot(botRow.id).catch(() => undefined);
  }
}
