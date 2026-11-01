import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { Command } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { HITLResponse } from "langchain";
import { and, eq } from "drizzle-orm";
import { createDb } from "../db";
import { agentUsage, bot, chatMessage, chatThread } from "../db/schema";
import { parseEnv, type Env } from "../lib/env";
import { nextMessageSeq } from "../lib/threads";
import { buildAgent } from "../agent/agent";
import { DEFAULT_MODEL_ID } from "../agent/models";
import { NeonHttpCheckpointer } from "../agent/checkpointer/neon-http-checkpointer";
import { parseChunk } from "../agent/stream";

export interface ChatRunParams {
  runId: string;
  threadId: string;
  userId: string;
  /** A new turn: the user's message. */
  userMessageId?: string;
  content?: string;
  modelId?: string;
  reasoningEffort?: string;
  /** A resumed turn: the user's decisions on the paused actions. */
  resume?: HITLResponse;
}

/** Coalesces tokens so the relay gets a few events a second, not one per token. */
class TokenBatcher {
  private text = "";
  private lastFlush = Date.now();
  constructor(private readonly send: (text: string) => Promise<void>) {}

  async push(text: string) {
    this.text += text;
    if (Date.now() - this.lastFlush >= 120) await this.flush();
  }

  async flush() {
    if (!this.text) return;
    const text = this.text;
    this.text = "";
    this.lastFlush = Date.now();
    await this.send(text);
  }
}

/**
 * ChatRunWorkflow: one agent run over a chat thread (or the resumption of a
 * paused one).
 *
 * The agent runs in a single step with no automatic retry: a retry would replay
 * and re-publish a half-streamed answer. Failures are reported to the client as
 * `run.failed` instead. Agent state is checkpointed per super-step in Neon, so
 * a paused run can resume from a separate workflow instance.
 */
export class ChatRunWorkflow extends WorkflowEntrypoint<Env, ChatRunParams> {
  async run(event: WorkflowEvent<ChatRunParams>, step: WorkflowStep): Promise<{ status: string }> {
    const params = event.payload;
    const env = parseEnv(this.env);
    try {
      await this.execute(env, params, step);
    } catch (error) {
      // A step died without reporting (timeout, platform error, missing
      // thread). Without a terminal event the client would sit on "Thinking…".
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
        .select({ name: bot.name, description: bot.description })
        .from(chatThread)
        .innerJoin(bot, eq(bot.id, chatThread.botId))
        .where(and(eq(chatThread.id, params.threadId), eq(chatThread.userId, params.userId)))
        .limit(1);
      if (!row) throw new Error(`Thread ${params.threadId} not found for user`);
      return row;
    });

    if (!params.resume) {
      await step.do("save-user-message", async () => {
        const db = createDb(env.DATABASE_URL);
        await db
          .insert(chatMessage)
          .values({
            id: params.userMessageId!,
            threadId: params.threadId,
            role: "user",
            parts: [{ type: "text", text: params.content }],
            runId: params.runId,
            seq: await nextMessageSeq(db, params.threadId),
          })
          // A retried send reuses the id, so the message is stored once.
          .onConflictDoNothing();
      });
    }

    await step.do(
      "run-agent",
      { retries: { limit: 0, delay: 1 }, timeout: `${env.RUN_TIMEOUT_SECONDS} seconds` },
      async () => {
        await this.runAgent(env, params, botRow);
      },
    );
  }

  private async runAgent(
    env: Env,
    params: ChatRunParams,
    botRow: { name: string; description: string | null },
  ) {
    const { runId, threadId, userId } = params;
    const db = createDb(env.DATABASE_URL);
    const publish = (type: string, payload: object) =>
      this.publish(env, threadId, type, { runId, ...payload });
    const tokens = new TokenBatcher((text) => publish("agent.token", { text }));
    const usage = { input: 0, output: 0 };
    const config = { configurable: { thread_id: threadId } };

    const recordUsage = async () => {
      if (usage.input + usage.output === 0) return;
      await db.insert(agentUsage).values({
        userId,
        threadId,
        runId,
        model: params.modelId ?? DEFAULT_MODEL_ID,
        inputTokens: usage.input,
        outputTokens: usage.output,
      });
    };

    try {
      const agent = buildAgent({
        bot: botRow,
        modelId: params.modelId,
        reasoningEffort: params.reasoningEffort,
        openrouterApiKey: env.OPENROUTER_API_KEY,
        tavilyApiKey: env.TAVILY_API_KEY,
        checkpointer: new NeonHttpCheckpointer(db),
        emit: ({ kind, ...rest }) =>
          publish(kind === "tool_call" ? "tool.call" : "tool.result", rest),
      });

      const stream = await agent.stream(
        params.resume
          ? new Command({ resume: params.resume })
          : { messages: [{ role: "user", content: params.content! }] },
        {
          ...config,
          streamMode: ["updates", "messages"],
          // "async" checkpoints can still be in flight when the step ends.
          durability: "sync",
          recursionLimit: 40,
        },
      );

      let approval: ReturnType<typeof parseChunk>["approval"];
      for await (const chunk of stream) {
        const parsed = parseChunk(chunk);
        if (parsed.text) await tokens.push(parsed.text);
        if (parsed.usage) {
          usage.input += parsed.usage.input;
          usage.output += parsed.usage.output;
        }
        approval ??= parsed.approval;
      }
      await tokens.flush();
      // Bookkeeping must never fail an answer the model already produced.
      await recordUsage().catch((e) => console.error("[chat-run] usage not recorded", e));

      if (approval) {
        await publish("run.waiting_approval", { actions: approval });
        return;
      }

      // The assistant message is keyed by run, so a resumed run adds to the
      // same turn and a duplicate finalisation is a no-op.
      const { values } = await agent.getState(config);
      const { messages } = values as { messages: BaseMessage[] };
      const text = messages.at(-1)?.text ?? "";
      const messageId = `${runId}:assistant`;
      const parts = [{ type: "text", text }];
      await db
        .insert(chatMessage)
        .values({
          id: messageId,
          threadId,
          role: "assistant",
          parts,
          runId,
          seq: await nextMessageSeq(db, threadId),
        })
        .onConflictDoNothing();
      await publish("run.done", { messageId, parts });
    } catch (error) {
      console.error("[chat-run] failed", error);
      await tokens.flush().catch(() => {});
      await recordUsage().catch(() => {});
      await publish("run.failed", {
        error: error instanceof Error ? error.message : "agent run failed",
        // HTTP status of the model provider, when the failure came from it.
        status: (error as { status?: number }).status,
      });
    }
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
