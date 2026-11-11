import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { parseEnv, type Env } from "../../config/env";
import { createDb } from "../../db";
import type { AssistantTodo } from "../../db/schema";
import { MAX_MODEL_RETRIES, retryDelayMs } from "../chat/run/types";
import { setLock } from "../workflows/store/lock";
import type { AssistantRunParams } from "./agent";
import { liveAssistant } from "./live";
import { type SliceInput, runAssistantSlice } from "./slice";
import { addMessage, getRunRow, setRun } from "./store";

/** Slices one assistant turn may use (each is up to RUN_SLICE_STEPS graph steps). */
const MAX_SLICES = 40;

export type AssistantWorkflowParams = AssistantRunParams & { content: string; fileIds: string[] };

/**
 * AssistantRunWorkflow: one assistant turn, in the cloud. It keeps going when the user closes the tab: progress is
 * saved to the database and pushed to any open builder, and the final answer is saved as a message. Confirmations
 * (turn on, share, connect apps) are a Workflow `waitForEvent`, so waiting costs nothing. The workflow's edit lock is
 * released on every way out.
 */
export class AssistantRunWorkflow extends WorkflowEntrypoint<Env, AssistantWorkflowParams> {
  async run(event: WorkflowEvent<AssistantWorkflowParams>, step: WorkflowStep) {
    const p = event.payload;
    const env = parseEnv(this.env);
    let todos: AssistantTodo[] = [];
    let outcome: { status: "succeeded" | "failed" | "cancelled"; answer: string; error?: string } = {
      status: "failed",
      answer: "",
      error: "The assistant stopped unexpectedly.",
    };
    try {
      await step.do("start", async () => {
        const db = createDb(env.DATABASE_URL);
        await setRun(db, p.runId, { status: "running" });
        await setLock(db, p.userId, p.workflowId, p.runId);
        const live = liveAssistant(env, p.workflowId);
        await live.lock(p.runId, true);
        await live.progress({ runId: p.runId, threadId: p.threadId, status: "running", todos: [] });
      });

      let input: SliceInput = { kind: "message", content: p.content, fileIds: p.fileIds };
      let retries = 0;
      for (let slice = 0; slice < MAX_SLICES; slice++) {
        const r = await step.do(
          `slice-${slice}`,
          // No automatic retry: a half-done slice re-run from the start would repeat its canvas edits.
          { retries: { limit: 0, delay: 1 }, timeout: "25 minutes" },
          () => runAssistantSlice(env, p, input, todos),
        );
        todos = r.todos;
        if (r.status === "retry") {
          if (++retries > MAX_MODEL_RETRIES) {
            outcome = { status: "failed", answer: "", error: `The model kept failing: ${r.error}` };
            break;
          }
          await step.sleep(`retry-wait-${slice}`, retryDelayMs(retries));
          // Resume from the last checkpoint (the failed slice saved nothing new).
          input = input.kind === "message" ? input : { kind: "continue" };
          continue;
        }
        retries = 0;
        if (r.status === "done") {
          outcome = { status: "succeeded", answer: r.answer };
          break;
        }
        if (r.status === "stopped") {
          outcome = { status: "cancelled", answer: "Stopped. What I changed so far is kept." };
          break;
        }
        if (r.status === "failed") {
          outcome = { status: "failed", answer: "", error: r.error };
          break;
        }
        if (r.status === "waiting") {
          await step.do(`ask-${slice}`, async () => {
            const db = createDb(env.DATABASE_URL);
            await setRun(db, p.runId, { status: "waiting", question: r.question });
            await liveAssistant(env, p.workflowId).progress({ runId: p.runId, threadId: p.threadId, status: "waiting", todos });
          });
          const reply = await step.waitForEvent<{ approved?: boolean; stop?: boolean }>(`answer-${slice}`, { type: "assistant-input", timeout: "7 days" });
          if (reply.payload?.stop) {
            outcome = { status: "cancelled", answer: "Stopped. What I changed so far is kept." };
            break;
          }
          await step.do(`resumed-${slice}`, () => setRun(createDb(env.DATABASE_URL), p.runId, { status: "running", question: null }));
          input = { kind: "resume", value: { approved: reply.payload?.approved === true } };
          continue;
        }
        // "continue": the slice hit its step or time limit.
        input = { kind: "continue" };
        if (slice === MAX_SLICES - 1) outcome = { status: "failed", answer: "", error: "This task got too long for one turn. Ask me to continue." };
      }
    } catch (error) {
      // waitForEvent timed out, or a step died without reporting.
      outcome = { status: "failed", answer: "", error: error instanceof Error ? error.message : "The assistant stopped." };
    }

    await step.do("finish", async () => {
      const db = createDb(env.DATABASE_URL);
      const content = outcome.status === "failed" ? `Stopped: ${outcome.error ?? "something went wrong"}` : outcome.answer;
      // The whole turn as the chat shows it (reasoning, tool calls, text). It ends with the answer; when the model
      // ended on a tool call or the run failed, the closing note is added so the chat always says how it ended.
      const parts = (await getRunRow(db, p.runId))?.parts ?? [];
      const last = parts.at(-1);
      const closed = last?.type === "text" && last.text.trim() === content.trim();
      await addMessage(db, { threadId: p.threadId, userId: p.userId, role: "assistant", content, todos, parts: closed ? parts : [...parts, { type: "text", text: content }], runId: p.runId });
      await setRun(db, p.runId, { status: outcome.status, error: outcome.error ?? null, question: null, todos, finishedAt: new Date() });
      await setLock(db, p.userId, p.workflowId, null, p.runId);
      const live = liveAssistant(env, p.workflowId);
      await live.lock(p.runId, false);
      await live.progress({ runId: p.runId, threadId: p.threadId, status: outcome.status, todos });
    });
    return { status: outcome.status };
  }
}
