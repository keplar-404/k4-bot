import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { createDb } from "../../../db";
import { parseEnv, type Env } from "../../../config/env";
import { publishEvent } from "./relay";
import { loadBot, saveUserMessage } from "./setup";
import { runSlice } from "./slice";
import { type ChatRunParams, MAX_SLEEP_MS, type UserInput } from "./types";

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
          error: error instanceof Error ? error.message : "The run did not finish.",
        });
      });
    }
    return { status: "done" };
  }

  private async execute(env: Env, params: ChatRunParams, step: WorkflowStep) {
    const botRow = await step.do("load-context", () => loadBot(createDb(env.DATABASE_URL), params));
    const attached = await step.do("save-user-message", () => saveUserMessage(createDb(env.DATABASE_URL), params, botRow.id));

    let resume: unknown;
    for (let slice = 0; slice < env.MAX_RUN_SLICES; slice++) {
      const result = await step.do(
        `slice-${slice}`,
        // No automatic retry: re-running a half-streamed slice would publish its events twice.
        { retries: { limit: 0, delay: 1 }, timeout: "25 minutes" },
        () => runSlice(env, params, botRow, attached, slice, resume),
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
    await publishEvent(env, params.threadId, "run.failed", {
      runId: params.runId,
      error: "This task reached the maximum length of one run. Ask the bot to continue.",
    });
  }
}
