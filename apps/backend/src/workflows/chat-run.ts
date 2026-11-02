import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { Command, GraphRecursionError } from "@langchain/langgraph";
import { and, eq, sql } from "drizzle-orm";
import { buildAgent } from "../agent/agent";
import { NeonHttpCheckpointer } from "../agent/checkpointer/neon-http-checkpointer";
import { DEFAULT_MODEL_ID } from "../agent/models";
import type { Part } from "../agent/parts";
import { consumeRun, type RunStream } from "../agent/run-stream";
import { createDb, type Db } from "../db";
import { agentUsage, bot, chatMessage, chatThread } from "../db/schema";
import { parseEnv, type Env } from "../lib/env";
import { nextMessageSeq, tokensUsedToday } from "../lib/threads";

export interface ChatRunParams {
  runId: string;
  threadId: string;
  userId: string;
  userMessageId: string;
  content: string;
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
        .select({ id: bot.id, name: bot.name, description: bot.description })
        .from(chatThread)
        .innerJoin(bot, eq(bot.id, chatThread.botId))
        .where(and(eq(chatThread.id, params.threadId), eq(chatThread.userId, params.userId)))
        .limit(1);
      if (!row) throw new Error(`Thread ${params.threadId} not found for user`);
      return row;
    });

    await step.do("save-user-message", async () => {
      const db = createDb(env.DATABASE_URL);
      await db
        .insert(chatMessage)
        .values({
          id: params.userMessageId,
          threadId: params.threadId,
          role: "user",
          parts: [{ type: "text", text: params.content }],
          runId: params.runId,
          seq: await nextMessageSeq(db, params.threadId),
        })
        // A retried send reuses the id, so the message is stored once.
        .onConflictDoNothing();
    });

    let resume: unknown;
    for (let slice = 0; slice < env.MAX_RUN_SLICES; slice++) {
      const result = await step.do(
        `slice-${slice}`,
        // No automatic retry: re-running a half-streamed slice would publish its events twice.
        { retries: { limit: 0, delay: 1 }, timeout: "25 minutes" },
        () => this.runSlice(env, params, botRow, slice, resume),
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
    botRow: { id: string; name: string; description: string | null },
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
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      if ((await tokensUsedToday(db, userId)) >= env.MAX_DAILY_TOKENS_PER_USER) {
        await publish("run.failed", { error: `Daily token budget of ${env.MAX_DAILY_TOKENS_PER_USER} reached. It resets at 00:00 UTC.` });
        return { status: "failed" };
      }

      const agent = buildAgent({
        bot: botRow,
        modelId: params.modelId,
        reasoningEffort: params.reasoningEffort,
        openrouterApiKey: env.OPENROUTER_API_KEY,
        tavilyApiKey: env.TAVILY_API_KEY,
        maxOutputTokens: env.MAX_OUTPUT_TOKENS,
        checkpointer: new NeonHttpCheckpointer(db),
        ...(stub ? { computer: { stub, runId } } : {}),
      }) as unknown as {
        streamEvents(input: unknown, config: object): Promise<RunStream & { abort?: () => void }>;
      };

      // First slice of a new run sends the user's message; later slices resume the checkpoint
      // (`null`), or answer the question the agent asked (`Command({ resume })`).
      // Clients show a question, approval or sleep until told the run went on.
      if (resume !== undefined) await publish("run.resumed", {});

      const input = resume !== undefined ? new Command({ resume }) : slice === 0 ? { messages: [{ role: "user", content: params.content }] } : null;

      const stream = await agent.streamEvents(input, {
        version: "v3",
        configurable: { thread_id: threadId },
        recursionLimit: env.RUN_SLICE_STEPS,
        durability: "sync",
      });
      controller = new AbortController();
      timer = setTimeout(() => stream.abort?.(), SLICE_WALL_MS);

      const { interrupt } = await consumeRun(
        stream,
        {
          text: (delta) => tokens.push(delta),
          reasoning: (delta) => thoughts.push(delta),
          toolStart: async (part) => {
            await flushAll();
            await publish("tool.start", { id: part.id, name: part.name, input: part.input });
          },
          toolEnd: (part) => publish("tool.end", { id: part.id, status: part.status, output: part.output }),
          partsChanged: saveProgress,
        },
        acc,
      );
      await flushAll();
      await saveProgress();

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
      controller?.abort();
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
