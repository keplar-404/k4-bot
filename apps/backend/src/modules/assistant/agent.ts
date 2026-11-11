import { and, eq, inArray } from "drizzle-orm";
import { createAgent, piiMiddleware, todoListMiddleware, toolCallLimitMiddleware } from "langchain";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { chatFile } from "../../db/schema";
import { assistantPrompt } from "../../prompts/assistant";
import { chatModelFor } from "../agent/chat-model";
import { NeonHttpCheckpointer } from "../agent/checkpointer/neon-http-checkpointer";
import { createTodoGuardMiddleware } from "../agent/middleware/todo-guard";
import { MAX_MODEL_RETRIES } from "../chat/run/types";
import { createToolErrorsMiddleware } from "../agent/middleware/tool-errors";
import { createToolRetryMiddleware } from "../agent/middleware/tool-retry";
import { DEFAULT_MODEL_ID, resolveModel } from "../agent/models";
import { MAX_VIEW_BYTES, toDataUrl } from "../agent/tools/files";
import { describeWorkflow, asText } from "../agent/workflows/common";
import { isInline } from "../files";
import { getWorkflow } from "../workflows/store/workflows";
import { MAX_TOOL_CALLS_PER_SLICE } from "./limits";
import { loadMemory } from "./store";
import { createAssistantTools } from "./tools";

/** Tries for a read-only tool that fails on a passing error. The model call has the same limit (MAX_MODEL_RETRIES). */
const MAX_TOOL_RETRIES = MAX_MODEL_RETRIES;
/** Assistant tools that only read, so a retry after a network hiccup cannot repeat an effect. */
const READ_ONLY_TOOLS = [
  "get_workflow",
  "list_block_kinds",
  "get_block_guide",
  "find_tools",
  "find_apps",
  "find_app_actions",
  "get_action_details",
  "find_app_events",
  "get_event_details",
  "get_run_report",
  "list_bots",
  "export_workflow_json",
];
/** The same key shapes a bot chat redacts (agent/middleware/stack.ts). */
const API_KEY = /(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})/;

/** Attached text files are read into the message up to this many characters each. */
const MAX_TEXT_FILE_CHARS = 30_000;
const TEXT_TYPES = /^(text\/|application\/(json|csv|xml|x-yaml|yaml))/;

export type AssistantRunParams = { runId: string; threadId: string; userId: string; workflowId: string; modelId?: string };

/**
 * The assistant for one slice of a run: LangChain's agent with the to-do list middleware (write_todos: the plan the
 * chat shows), its workflow tools, and the Postgres checkpointer so a later slice, or a confirmation days later,
 * resumes where it stopped.
 */
export async function buildAssistant(env: Env, db: Db, p: AssistantRunParams) {
  if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured.");
  const w = await getWorkflow(db, p.userId, p.workflowId);
  if (!w) throw new Error("The workflow no longer exists.");
  const { model, createModel } = chatModelFor({ modelId: p.modelId, apiKey: env.OPENROUTER_API_KEY, maxOutputTokens: env.MAX_OUTPUT_TOKENS });
  const agent = createAgent({
    model: createModel(),
    tools: createAssistantTools({ env, db, userId: p.userId, workflowId: p.workflowId, runId: p.runId }),
    middleware: [
      // The same guards as a bot chat: a failed tool call becomes a message the model can fix (not a dead run), and
      // read-only lookups get two more tries on a network hiccup.
      createToolErrorsMiddleware(),
      // Up to 10 tries on a network hiccup (a bot chat uses 2); the model call itself is retried up to 10 times by the run.
      createToolRetryMiddleware(READ_ONLY_TOOLS, MAX_TOOL_RETRIES),
      // The plan the chat shows (write_todos), and the chat's todo guard: a model that stops with steps still open
      // is sent back to them (twice at most), and after a long piece of work it verifies the result before answering.
      todoListMiddleware(),
      createTodoGuardMiddleware(),
      // A confused model cannot loop through paid calls.
      toolCallLimitMiddleware({ runLimit: MAX_TOOL_CALLS_PER_SLICE, exitBehavior: "continue" }),
      // Like a bot chat: the model never sees card numbers or key-shaped secrets (from the user, files or app data).
      piiMiddleware("credit_card", { strategy: "redact", applyToInput: true, applyToToolResults: true }),
      piiMiddleware("api_key", { detector: API_KEY, strategy: "redact", applyToInput: true, applyToToolResults: true }),
    ],
    systemPrompt: assistantPrompt({
      memory: await loadMemory(db, p.userId),
      workflow: asText(describeWorkflow(w, true), 12_000),
      today: new Date().toISOString().slice(0, 10),
    }),
    checkpointer: new NeonHttpCheckpointer(db),
  });
  return { agent, model };
}

/**
 * The user's message as the model gets it: the text, attached images as pictures (vision models only), and attached
 * text files inline, marked as data.
 */
export async function userContent(env: Env, db: Db, userId: string, text: string, fileIds: string[], modelId?: string) {
  if (fileIds.length === 0) return text;
  const files = await db
    .select()
    .from(chatFile)
    .where(and(eq(chatFile.userId, userId), inArray(chatFile.id, fileIds)));
  const vision = resolveModel(modelId ?? DEFAULT_MODEL_ID)?.vision ?? false;
  const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [{ type: "text", text }];
  for (const f of files) {
    const object = env.FILES ? await env.FILES.get(f.storageKey) : null;
    if (!object) continue;
    if (isInline(f.mimeType) && f.size <= MAX_VIEW_BYTES) {
      if (vision) parts.push({ type: "image_url", image_url: { url: toDataUrl(f.mimeType, new Uint8Array(await object.arrayBuffer())) } });
      else parts.push({ type: "text", text: `[Attached image "${f.name}": this model cannot see images.]` });
    } else if (TEXT_TYPES.test(f.mimeType)) {
      const body = (await object.text()).slice(0, MAX_TEXT_FILE_CHARS);
      parts.push({ type: "text", text: `<data file="${f.name.replace(/"/g, "")}">\n${body}\n</data>` });
    }
  }
  return parts;
}
