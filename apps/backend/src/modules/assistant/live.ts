import type { Env } from "../../config/env";
import type { AssistantTodo } from "../../db/schema";
import type { AssistantRunStatus } from "../workflows/live/events";
import { publishLive } from "../workflows/live/publish";

const now = () => new Date().toISOString();

/**
 * The assistant talks to the builder through the workflow's own live socket (the page the user watches): progress for
 * the chat panel, draft changes for the canvas, and the edit lock. None of it carries tool calls or data.
 */
export const liveAssistant = (env: Env, workflowId: string) => ({
  progress: (p: { runId: string; threadId: string; status: AssistantRunStatus; todos: AssistantTodo[] }) =>
    publishLive(env, workflowId, { type: "assistant.progress", ...p, at: now() }),
  parts: (p: { runId: string; threadId: string; parts: unknown[] }) => publishLive(env, workflowId, { type: "assistant.parts", ...p, at: now() }),
  draftUpdated: () => publishLive(env, workflowId, { type: "draft.updated", at: now() }),
  lock: (runId: string, locked: boolean) => publishLive(env, workflowId, { type: "assistant.lock", runId, locked, at: now() }),
});
