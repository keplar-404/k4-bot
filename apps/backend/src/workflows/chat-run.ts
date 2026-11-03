import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { Command, GraphRecursionError } from "@langchain/langgraph";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { type AgentBot, buildAgent } from "../agent/agent";
import { NeonHttpCheckpointer } from "../agent/checkpointer/neon-http-checkpointer";
import { DEFAULT_MODEL_ID, resolveModel } from "../agent/models";
import type { FileRef, Part } from "../agent/parts";
import { MAX_VIEW_BYTES, MAX_VIEW_IMAGES, toDataUrl } from "../agent/tools/files";
import { connectBotApps, type BotApps } from "../agent/mcp";
import { collectUnfinished, GroupHub } from "../agent/tools/subagents";
import { consumeRun, type RunStream } from "../agent/run-stream";
import { loadBotSkills } from "../lib/skills";
import { catalogMcp } from "../lib/catalog/mcp";
import { createDb, type Db } from "../db";
import { agentUsage, bot, chatFile, chatMessage, chatThread, userMcpServer, userSkill } from "../db/schema";
import { formatBytes, isInline, toRef } from "../lib/files";
import { parseEnv, type Env } from "../lib/env";
import { getOwnedThread, nextMessageSeq, tokensUsedToday } from "../lib/threads";

export interface ChatRunParams {
  runId: string;
  threadId: string;
  userId: string;
  userMessageId: string;
  content: string;
  /** Files the user attached (uploaded beforehand with POST /files). */
  fileIds?: string[];
  modelId?: string;
  reasoningEffort?: string;
}

/** What the user (or the clock) must supply before the run can go on, or how it ended. */
type SliceResult =
  | { status: "done" | "failed" | "continue" }
  | { status: "needs_input"; kind: "approval" | "answer" }
  | { status: "sleep"; ms: number };

/** The payload of the `user-input` event sent by POST /chat/runs/:id/resume. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export interface UserInput {
  decisions?: Json[];
  answer?: string;
}

/** A slice stops itself well inside the 30 minute guidance for a Workflow step and carries on in the next one. */
const SLICE_WALL_MS = 20 * 60_000;
const MAX_SLEEP_MS = 7 * 24 * 60 * 60_000;

/** Shell and file tools as one line for the computer's Activity feed (screen actions are noted by the computer itself). */
function describeActivity(name: string, input: string): string | null {
  let a: Record<string, unknown> = {};
  try {
    a = JSON.parse(input) as Record<string, unknown>;
  } catch {
    // clipped input: fall back to the tool name only
  }
  const path = String(a.file_path ?? a.path ?? "");
  switch (name) {
    case "execute":
      return `Ran ${String(a.command ?? "a command")}`;
    case "write_file":
      return `Wrote ${path}`;
    case "edit_file":
      return `Edited ${path}`;
    case "read_file":
      return `Read ${path}`;
    case "ls":
      return `Listed ${path}`;
    case "glob":
    case "grep":
      return `Searched files ${String(a.pattern ?? "")}`.trim();
    case "share_file":
      return `Shared ${path} with the user`;
    case "copy_to_computer":
      return `Copied a file to ${path || "its files folder"}`;
    default:
      return null;
  }
}

/** Coalesces tokens so the relay gets a few events a second, not one per token. */
class TokenBatcher {
  private text = "";
  private last = Date.now();
  constructor(private readonly send: (text: string) => Promise<void>) {}

  async push(text: string) {
    this.text += text;
    if (Date.now() - this.last >= 120) await this.flush();
  }

  async flush() {
    if (!this.text) return;
    const text = this.text;
    this.text = "";
    this.last = Date.now();
    await this.send(text);
  }
}

/**
 * ChatRunWorkflow: one agent run, however long it takes.
 *
 * A run is a loop of bounded "slices". Each slice is its own durable step that
 * drives the agent up to RUN_SLICE_STEPS graph steps, then hands back: the
 * agent's state is checkpointed in Postgres, so the next slice resumes exactly
 * where it stopped (`streamEvents(null)` continues from the checkpoint).
 * Anything that needs a human or the clock is a Workflow primitive, not a held
 * process: `waitForEvent` for approvals and answers (up to 7 days),
 * `sleep` for "come back later" (up to 7 days per sleep). Waiting costs nothing.
 * https://developers.cloudflare.com/workflows/build/rules-of-workflows/
 */
export class ChatRunWorkflow extends WorkflowEntrypoint<Env, ChatRunParams> {
  async run(event: WorkflowEvent<ChatRunParams>, step: WorkflowStep): Promise<{ status: string }> {
    const params = event.payload;
    const env = parseEnv(this.env);
    try {
      await this.execute(env, params, step);
    } catch (error) {
      // A step died without reporting (timeout, platform error, nobody answered in time).
      // Without a terminal event the client would sit on "Thinking…" forever.
      await step.do("report-failure", async () => {
        await this.publish(env, params.threadId, "run.failed", {
          runId: params.runId,
          error: error instanceof Error ? error.message : "The run did not finish.",
        });
      });
    }
    return { status: "done" };
  }

  private async execute(env: Env, params: ChatRunParams, step: WorkflowStep) {
    const botRow = await step.do("load-context", async () => {
      const db = createDb(env.DATABASE_URL);
      const [row] = await db
        .select({
          id: bot.id,
          name: bot.name,
          description: bot.description,
          role: bot.role,
          roleTitle: bot.roleTitle,
          subagentsEnabled: bot.subagentsEnabled,
          maxSubagents: bot.maxSubagents,
          maxParallelTools: bot.maxParallelTools,
        })
        .from(chatThread)
        .innerJoin(bot, eq(bot.id, chatThread.botId))
        .where(and(eq(chatThread.id, params.threadId), eq(chatThread.userId, params.userId)))
        .limit(1);
      if (!row) throw new Error(`Thread ${params.threadId} not found for user`);
      return row;
    });

    const attached = await step.do("save-user-message", async () => {
      const db = createDb(env.DATABASE_URL);
      // The user's own files only; they now belong to this chat (and stay in the Files page if it is deleted).
      const files: FileRef[] = params.fileIds?.length
        ? (
            await db
              .select()
              .from(chatFile)
              .where(and(eq(chatFile.userId, params.userId), inArray(chatFile.id, params.fileIds)))
          ).map(toRef)
        : [];
      if (files.length) {
        await db
          .update(chatFile)
          .set({ threadId: params.threadId, botId: botRow.id })
          .where(and(eq(chatFile.userId, params.userId), inArray(chatFile.id, files.map((f) => f.id)), isNull(chatFile.threadId)));
      }
      await db
        .insert(chatMessage)
        .values({
          id: params.userMessageId,
          threadId: params.threadId,
          role: "user",
          parts: [{ type: "text", text: params.content }, ...files.map((file) => ({ type: "file" as const, file }))],
          runId: params.runId,
          seq: await nextMessageSeq(db, params.threadId),
        })
        // A retried send reuses the id, so the message is stored once.
        .onConflictDoNothing();
      return files;
    });

    let resume: unknown;
    for (let slice = 0; slice < env.MAX_RUN_SLICES; slice++) {
      const result = await step.do(
        `slice-${slice}`,
        // No automatic retry: re-running a half-streamed slice would publish its events twice.
        { retries: { limit: 0, delay: 1 }, timeout: "25 minutes" },
        () => this.runSlice(env, params, botRow, attached, slice, resume),
      );
      resume = undefined;

      if (result.status === "done" || result.status === "failed") return;
      if (result.status === "sleep") {
        await step.sleep(`sleep-${slice}`, Math.min(result.ms, MAX_SLEEP_MS));
        resume = "Resumed after waiting.";
      } else if (result.status === "needs_input") {
        // An answer sent early is buffered until this point, so the user can never miss the window.
        const reply = await step.waitForEvent(`input-${slice}`, { type: "user-input", timeout: "7 days" });
        const answer = reply.payload as UserInput;
        resume = result.kind === "approval" ? { decisions: answer.decisions } : (answer.answer ?? "");
      }
      // "continue": the slice hit its step limit; the next one resumes from the checkpoint.
    }
    await this.publish(env, params.threadId, "run.failed", {
      runId: params.runId,
      error: "This task reached the maximum length of one run. Ask the bot to continue.",
    });
  }

  private async runSlice(
    env: Env,
    params: ChatRunParams,
    botRow: AgentBot,
    attached: FileRef[],
    slice: number,
    resume: unknown,
  ): Promise<SliceResult> {
    const { runId, threadId, userId } = params;
    const db = createDb(env.DATABASE_URL);
    const publish = (type: string, payload: object) => this.publish(env, threadId, type, { runId, ...payload });
    const tokens = new TokenBatcher((text) => publish("agent.token", { text }));
    const thoughts = new TokenBatcher((text) => publish("agent.reasoning", { text }));
    const flushAll = async () => {
      await thoughts.flush();
      await tokens.flush();
    };

    const acc = { parts: [] as Part[], usage: { input: 0, output: 0 } };
    let saved = 0;
    /** Saves every finished part so far. A running tool call is kept back until it ends. */
    const saveProgress = async () => {
      let end = saved;
      while (end < acc.parts.length && !(acc.parts[end]!.type === "tool" && (acc.parts[end] as { status: string }).status === "running")) end++;
      if (end === saved) return;
      const fresh = acc.parts.slice(saved, end);
      saved = end;
      await this.appendParts(db, params, fresh);
    };

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
      if ((await tokensUsedToday(db, userId)) >= env.MAX_DAILY_TOKENS_PER_USER) {
        await publish("run.failed", { error: `Daily token budget of ${env.MAX_DAILY_TOKENS_PER_USER} reached. It resets at 00:00 UTC.` });
        return { status: "failed" };
      }

      // The user's other bots, so the prompt can say where their files are (one small query, no E2B call).
      const peers = stub
        ? await db
            .select({ id: bot.id, name: bot.name })
            .from(bot)
            .where(and(eq(bot.userId, userId), sql`${bot.id} <> ${botRow.id}`))
        : [];

      // Attached images are shown to a vision model during the whole run (read again per slice: R2 only, no third party).
      const images: Array<{ name: string; dataUrl: string }> = [];
      if (env.FILES && resolveModel(params.modelId ?? DEFAULT_MODEL_ID)?.vision) {
        for (const f of attached.filter((f) => isInline(f.mimeType) && f.size <= MAX_VIEW_BYTES).slice(0, MAX_VIEW_IMAGES)) {
          const [row] = await db.select({ key: chatFile.storageKey }).from(chatFile).where(and(eq(chatFile.id, f.id), eq(chatFile.userId, userId)));
          const object = row ? await env.FILES.get(row.key) : null;
          if (object) images.push({ name: f.name, dataUrl: toDataUrl(f.mimeType, new Uint8Array(await object.arrayBuffer())) });
        }
      }

      // The bot's skills (read from R2) and connected apps (MCP servers; tokens decrypted here, for this slice only).
      const skills = env.FILES ? await loadBotSkills(env.FILES, db, userId, botRow.id) : {};
      apps = await connectBotApps(env, db, userId, botRow.id);
      // A bot that spawns sub-agents may give them any skill or app the user installed (two small queries, no third party).
      const subagents = botRow.subagentsEnabled
        ? {
            env,
            db,
            userId,
            threadId,
            runId,
            installedSkills: await db
              .select({ name: userSkill.name, skillId: userSkill.skillId, storageKey: userSkill.storageKey, description: userSkill.description })
              .from(userSkill)
              .where(eq(userSkill.userId, userId)),
            connectedApps: (
              await db
                .select({ id: userMcpServer.id, serverId: userMcpServer.serverId, secrets: userMcpServer.secrets })
                .from(userMcpServer)
                .where(eq(userMcpServer.userId, userId))
            ).flatMap((r) => {
              const entry = catalogMcp(r.serverId);
              return entry ? [{ ...r, name: entry.name }] : [];
            }),
            // Live status of the group for the chat (not stored: the tool's result has the reports).
            report: (toolCallId: string, agents: unknown) => publish("tool.progress", { id: toolCallId, agents }),
            hub,
            sliceDeadline,
          }
        : undefined;

      const agent = buildAgent({
        bot: botRow,
        skills,
        apps,
        subagents,
        peers,
        modelId: params.modelId,
        reasoningEffort: params.reasoningEffort,
        openrouterApiKey: env.OPENROUTER_API_KEY,
        tavilyApiKey: env.TAVILY_API_KEY,
        maxOutputTokens: env.MAX_OUTPUT_TOKENS,
        checkpointer: new NeonHttpCheckpointer(db),
        ...(stub ? { computer: { stub, runId } } : {}),
        ...(env.FILES
          ? {
              files: {
                bucket: env.FILES,
                db,
                userId,
                threadId,
                runId,
                imageModel: env.IMAGE_MODEL,
                maxImagesPerDay: env.MAX_IMAGES_PER_DAY,
                maxStorageBytes: env.MAX_STORAGE_MB_PER_USER * 1024 * 1024,
                attached: images,
              },
            }
          : {}),
      }) as unknown as {
        streamEvents(input: unknown, config: object): Promise<RunStream & { abort?: () => void }>;
      };

      // First slice of a new run sends the user's message; later slices resume the checkpoint
      // (`null`), or answer the question the agent asked (`Command({ resume })`).
      // Clients show a question, approval or sleep until told the run went on.
      if (resume !== undefined) await publish("run.resumed", {});

      // Attached files are listed under the message, so the model knows their ids.
      const content = attached.length
        ? `${params.content}\n\n[Attached files]\n${attached.map((f) => `- "${f.name}" (${f.mimeType}, ${formatBytes(f.size)}, file id ${f.id})`).join("\n")}`
        : params.content;
      // A new message also clears the cached skill list, so skills added to or removed from the bot since the
      // last message are seen (Deep Agents keeps the list in the thread's state once loaded).
      const input = resume !== undefined ? new Command({ resume }) : slice === 0 ? { messages: [{ role: "user", content }], skillsMetadata: null } : null;

      const sink = {
        text: (delta: string) => tokens.push(delta),
        reasoning: (delta: string) => thoughts.push(delta),
        toolStart: async (part: { id: string; name: string; input: string }) => {
          await flushAll();
          await publish("tool.start", { id: part.id, name: part.name, input: part.input });
          const line = describeActivity(part.name, part.input);
          if (line) await stub?.logActivity(botRow.id, line).catch(() => undefined);
        },
        toolEnd: (part: { id: string; status: string; output?: string; files?: unknown }) =>
          publish("tool.end", { id: part.id, status: part.status, output: part.output, files: part.files }),
        partsChanged: saveProgress,
      };
      const stream = await agent.streamEvents(input, {
        version: "v3",
        configurable: { thread_id: threadId },
        recursionLimit: env.RUN_SLICE_STEPS,
        durability: "sync",
      });
      timer = setTimeout(() => stream.abort?.(), sliceDeadline - Date.now());
      let { interrupt } = await consumeRun(stream, sink, acc);
      await flushAll();
      await saveProgress();

      // The bot ended its turn while a sub-agent group was still working: wait for the group, then hand its results
      // back to the bot so it can act on them (they would otherwise be lost when this segment ends).
      if (!interrupt && hub.groups.size > 0) {
        const results = await collectUnfinished(hub);
        if (results) {
          const followUp = await agent.streamEvents(
            { messages: [{ role: "user", content: `[Automatic message] Your sub-agent group finished after your last reply. Act on its results now.\n\n${results}` }] },
            { version: "v3", configurable: { thread_id: threadId }, recursionLimit: env.RUN_SLICE_STEPS, durability: "sync" },
          );
          ({ interrupt } = await consumeRun(followUp, sink, acc));
          await flushAll();
          await saveProgress();
        }
      }

      if (interrupt) {
        const payload = (interrupt.payload ?? {}) as { actionRequests?: unknown; kind?: string; question?: string; ms?: number; reason?: string };
        if (payload.actionRequests) {
          await publish("run.waiting_approval", { actions: payload.actionRequests });
          return { status: "needs_input", kind: "approval" };
        }
        if (payload.kind === "sleep") {
          const ms = Math.min(Math.max(Number(payload.ms) || 60_000, 60_000), MAX_SLEEP_MS);
          await publish("run.sleeping", { until: Date.now() + ms, reason: payload.reason ?? "" });
          return { status: "sleep", ms };
        }
        await publish("run.waiting_input", { kind: payload.kind ?? "info", question: payload.question ?? "The bot needs your input." });
        return { status: "needs_input", kind: "answer" };
      }

      await publish("run.done", { messageId: `${runId}:assistant` });
      return { status: "done" };
    } catch (error) {
      await flushAll().catch(() => undefined);
      await saveProgress().catch(() => undefined);
      // The slice hit its step limit (or its time limit). The checkpoint is intact; carry on in the next slice.
      if (error instanceof GraphRecursionError || (error as Error)?.name === "AbortError") return { status: "continue" };
      console.error("[chat-run] failed", error);
      await publish("run.failed", {
        error: error instanceof Error ? error.message : "agent run failed",
        // HTTP status of the model provider, when the failure came from it.
        status: (error as { status?: number }).status,
      });
      return { status: "failed" };
    } finally {
      clearTimeout(timer);
      await apps?.close();
      if (acc.usage.input + acc.usage.output > 0) {
        await db
          .insert(agentUsage)
          .values({
            userId,
            threadId,
            runId,
            model: params.modelId ?? DEFAULT_MODEL_ID,
            inputTokens: acc.usage.input,
            outputTokens: acc.usage.output,
          })
          // Bookkeeping must never fail the slice.
          .catch((e: unknown) => console.error("[chat-run] usage not recorded", e));
      }
      // Hand the mouse and keyboard back so the user's other bots are not blocked between slices.
      await stub?.releaseBot(botRow.id).catch(() => undefined);
    }
  }

  /** Appends finished parts to this run's assistant message, creating it on first use. */
  private async appendParts(db: Db, params: ChatRunParams, parts: Part[]) {
    await db
      .insert(chatMessage)
      .values({
        id: `${params.runId}:assistant`,
        threadId: params.threadId,
        role: "assistant",
        parts,
        runId: params.runId,
        seq: await nextMessageSeq(db, params.threadId),
      })
      // jsonb array concatenation: the message grows as the run goes on, across slices.
      .onConflictDoUpdate({ target: chatMessage.id, set: { parts: sql`${chatMessage.parts} || excluded.parts` } });
  }

  private async publish(env: Env, threadId: string, type: string, payload: object) {
    const stub = env.CHAT_RELAY.get(env.CHAT_RELAY.idFromName(threadId));
    const response = await stub.fetch("https://relay/publish", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": env.WS_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET,
      },
      body: JSON.stringify({ threadId, type, payload }),
    });
    if (!response.ok) console.error("[chat-run] publish failed", type, response.status);
  }
}
