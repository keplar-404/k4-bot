import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { createDb } from "../../../db";
import { runTrace } from "../../../db/schema";
import { parseEnv, type Env } from "../../../config/env";
import { startNextTurn } from "../../groups/chain";
import { groupTurn } from "../../groups/brief";
import { getOwnedGroup } from "../../groups/store";
import { autoUpdateMemory } from "../../memory/auto/update";
import { publishEvent } from "./relay";
import { loadBot, saveUserMessage } from "./setup";
import { runSlice } from "./slice";
import { type ChatRunParams, MAX_MODEL_RETRIES, MAX_SLEEP_MS, retryDelayMs, type UserInput } from "./types";

export type { ChatRunParams, UserInput } from "./types";

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
        await publishEvent(env, params.threadId, "run.failed", {
          runId: params.runId,
          ...(params.botId ? { botId: params.botId } : {}),
          error: error instanceof Error ? error.message : "The run did not finish.",
        });
      });
    }
    return { status: "done" };
  }

  private async execute(env: Env, params: ChatRunParams, step: WorkflowStep) {
    const botRow = await step.do("load-context", () => loadBot(createDb(env.DATABASE_URL), params));
    const attached = await step.do("save-user-message", () => saveUserMessage(createDb(env.DATABASE_URL), params, botRow.id));
    // Group chats: the members, and what this member is told (the chat since its last turn, then its task).
    const group = params.botId
      ? await step.do("group-context", async () => {
          const turn = await groupTurn(createDb(env.DATABASE_URL), params, botRow.id);
          return turn ? { groupId: turn.group.id, members: turn.members, content: turn.content } : null;
        })
      : null;
    const runParams = group && !params.compact && !params.research ? { ...params, content: group.content } : params;

    let resume: unknown;
    // Model failures in a row; any slice that gets through resets it.
    let retries = 0;
    for (let slice = 0; slice < env.MAX_RUN_SLICES; slice++) {
      const result = await step.do(
        `slice-${slice}`,
        // No automatic retry: re-running a half-streamed slice would publish its events twice.
        { retries: { limit: 0, delay: 1 }, timeout: "25 minutes" },
        () => runSlice(env, runParams, botRow, attached, slice, resume, group ?? undefined),
      );
      // One row per slice: model, status, retry count and why. A failed run is now diagnosable.
      await step.do(`trace-${slice}`, async () => {
        const db = createDb(env.DATABASE_URL);
        await db
          .insert(runTrace)
          .values({
            id: crypto.randomUUID(),
            kind: "chat_slice",
            runId: params.runId,
            threadId: params.threadId,
            userId: params.userId,
            modelId: params.modelId ?? null,
            status: result.status,
            slices: slice + 1,
            retries,
            stopReason: result.status === "retry" ? result.reason : null,
            error: "error" in result ? String(result.error).slice(0, 500) : null,
            finishedAt: new Date(),
          })
          .catch((e: unknown) => console.error("[trace] not written", e));
      });

      if (result.status === "retry") {
        // `resume` is kept: an answer or approval the failed slice was carrying is delivered by the retry.
        retries++;
        if (retries > MAX_MODEL_RETRIES) {
          await step.do(`give-up-${slice}`, () =>
            publishEvent(env, params.threadId, "run.failed", {
              runId: params.runId,
              error: `The model failed ${MAX_MODEL_RETRIES} times in a row: ${result.error}`,
              status: result.httpStatus,
              reason: result.reason,
            }),
          );
          return;
        }
        const ms = retryDelayMs(retries);
        // The chat drops the text the failed call streamed (never saved) and reloads what was saved.
        await step.do(`retrying-${slice}`, () =>
          publishEvent(env, params.threadId, "run.retrying", { runId: params.runId, attempt: retries, maxAttempts: MAX_MODEL_RETRIES, inMs: ms, error: result.error }),
        );
        await step.sleep(`retry-wait-${slice}`, ms);
        // Each slice checks the daily token budget, the thread and the computer's limits again before going on.
        continue;
      }
      retries = 0;
      resume = undefined;

      if (result.status === "done") {
        // Learn from the turn after it is answered: never delays the reply, and its own step, so a crash here
        // cannot touch the answer. Scheduled-task prompts are not the user speaking, so they teach nothing.
        if (group) {
          await step.do("next-turn", () => startNextTurn(env, createDb(env.DATABASE_URL), params, { id: botRow.id, name: botRow.name, groupId: group.groupId }));
        }
        if (!params.content.startsWith("⏰") && !params.chained) {
          await step.do("auto-memory", { retries: { limit: 0, delay: 1 }, timeout: "2 minutes" }, async () => {
            const db = createDb(env.DATABASE_URL);
            const owned = group ? await getOwnedGroup(db, params.userId, group.groupId) : null;
            const updates = await autoUpdateMemory(env, db, {
              group: owned ? { id: owned.id, name: owned.name, memory: owned.memory } : undefined,
              userId: params.userId,
              botId: botRow.id,
              threadId: params.threadId,
              runId: params.runId,
              modelId: params.modelId,
              userText: params.content,
            });
            for (const u of updates) await publishEvent(env, params.threadId, "memory.updated", u);
            return updates.length;
          });
        }
        return;
      }
      if (result.status === "failed") return;
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
    await publishEvent(env, params.threadId, "run.failed", {
      runId: params.runId,
      error: "This task reached the maximum length of one run. Ask the bot to continue.",
      notice: true,
    });
  }
}
