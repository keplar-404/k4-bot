import { and, eq, inArray } from "drizzle-orm";
import { tool } from "langchain";
import { z } from "zod";
import type { Env } from "../../../../config/env";
import type { Db } from "../../../../db";
import { chatFile } from "../../../../db/schema";
import { loadBotComposioApps } from "../../../agent/composio/bot-apps";
import { createComposioTools } from "../../../agent/composio/tools";
import { createWebTools } from "../../../agent/tools/web";
import { canRead, loadFile, readDocument } from "../../../files";
import { READ_ONLY_APP_TOOLS } from "./ai-prompt";

const MAX_KNOWLEDGE_CHARS = 40_000;

/**
 * The AI step's tools: web search, reading the bot's own connected apps (when allowed; never an action that changes
 * anything), and reading the knowledge files the block lists (only those, only the user's own).
 */
export async function aiStepTools(
  env: Env,
  db: Db,
  run: { id: string; userId: string; botId: string },
  config: { useApps: boolean; files: string[] },
) {
  const apps = config.useApps ? await loadBotComposioApps(db, run.botId) : [];
  const appTools = apps.length
    ? createComposioTools({ env, userId: run.userId, apps }).tools.filter((t) => READ_ONLY_APP_TOOLS.has(t.name))
    : [];
  const webTools = env.TAVILY_API_KEY ? createWebTools({ apiKey: env.TAVILY_API_KEY }) : [];

  const files =
    config.files.length && env.FILES
      ? await db
          .select({ id: chatFile.id, name: chatFile.name, mimeType: chatFile.mimeType })
          .from(chatFile)
          .where(and(eq(chatFile.userId, run.userId), inArray(chatFile.id, config.files)))
      : [];
  const readable = files.filter((f) => canRead(f.mimeType));
  const bucket = env.FILES;
  const knowledgeTool =
    readable.length && bucket
      ? tool(
          async ({ file_id, pages }) => {
            if (!readable.some((f) => f.id === file_id)) return "NOT DONE: that file is not one of this step's knowledge files.";
            const file = await loadFile(bucket, db, run.userId, file_id);
            if (!file) return "NOT DONE: the file was deleted.";
            const options = { bucket, db, userId: run.userId, apiKey: env.OPENROUTER_API_KEY ?? "", vision: false, maxImages: 0 };
            // No paid OCR here: a busy trigger could run it thousands of times. Text PDFs and documents still read.
            const read = await readDocument(
              { ...options, ocr: "off", maxOcrPagesPerDay: 0, usage: { threadId: "", runId: run.id } },
              file,
              { pages },
            );
            return read.text.slice(0, MAX_KNOWLEDGE_CHARS);
          },
          {
            name: "read_knowledge",
            description: "Read one of this step's knowledge files by id (text, page by page). Ask for pages (\"1-5\") in long files.",
            schema: z.object({ file_id: z.string(), pages: z.string().max(100).optional() }),
          },
        )
      : null;

  return {
    tools: [...webTools, ...appTools, ...(knowledgeTool ? [knowledgeTool] : [])],
    knowledge: readable.map(({ id, name }) => ({ id, name })),
  };
}

/** Which tools the bot called, with their arguments cut short: shown in the run viewer as what it did. */
export function toolTrace(messages: unknown[]) {
  const calls = messages.flatMap(
    (m) => (m as { tool_calls?: Array<{ name: string; args: unknown }> }).tool_calls ?? [],
  );
  return calls.slice(0, 20).map((c) => ({ tool: c.name, args: JSON.stringify(c.args ?? {}).slice(0, 300) }));
}
