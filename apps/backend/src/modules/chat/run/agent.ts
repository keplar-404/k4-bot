import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import { buildAgent, type BuildAgentOptions } from "../../agent/agent";
import { NeonHttpCheckpointer } from "../../agent/checkpointer/neon-http-checkpointer";
import type { RunStream } from "../../agent/run-stream";
import type { ComputerStub } from "../../computer/sandbox-backend";
import { isMode } from "../modes";
import { getOwnedThread } from "../threads";
import { fileOptions } from "./context";
import { pgResearchArchive } from "./research-archive";
import type { ChatRunParams } from "./types";

type Streamable = {
  streamEvents(input: unknown, config: object): Promise<RunStream & { abort?: () => void }>;
  updateState(config: object, values: unknown): Promise<unknown>;
  getState(config: object): Promise<{ tasks?: Array<{ interrupts?: unknown[] }> }>;
};

/** The bot's agent for one slice, with this run's model, keys, computer and files. */
export function buildRunAgent(
  env: Env,
  db: Db,
  params: ChatRunParams,
  parts: Pick<BuildAgentOptions, "bot" | "skills" | "apps" | "subagents" | "peers" | "contextLength" | "memory" | "mode" | "account"> & { stub?: ComputerStub; images: Array<{ name: string; dataUrl: string }> },
): Streamable {
  const { stub, images, ...rest } = parts;
  const isCoding = rest.bot?.role === "coding";
  return buildAgent({
    ...rest,
    modelId: params.modelId,
    reasoningEffort: params.reasoningEffort,
    compact: params.compact,
    openrouterApiKey: env.OPENROUTER_API_KEY,
    freeVisionModel: env.FREE_VISION_MODEL,
    web: webOptions(env, db, params, rest.bot.id),
    maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    checkpointer: new NeonHttpCheckpointer(db),
    ...(stub ? { computer: { stub, runId: params.runId } } : {}),
    ...(isCoding ? { sandbox: { env, db, userId: params.userId } } : {}),
    readMode: async () => {
      const thread = await getOwnedThread(db, params.threadId, params.userId);
      return isMode(thread?.mode) ? thread.mode : "ask";
    },
    asyncTasks: { env, threadId: params.threadId, userId: params.userId, botName: parts.bot.name, modelId: params.modelId },
    files: fileOptions(env, db, params, images),
  }) as unknown as Streamable;
}

/** Tavily tools; in a /deep-research run also tavily_research with its archive (task ids + report files). */
function webOptions(env: Env, db: Db, params: ChatRunParams, botId: string) {
  if (!env.TAVILY_API_KEY) return undefined;
  if (!params.research) return { apiKey: env.TAVILY_API_KEY };
  const archive = pgResearchArchive({ db, bucket: env.FILES, userId: params.userId, threadId: params.threadId, botId, maxStorageBytes: env.MAX_STORAGE_MB_PER_USER * 1024 * 1024 });
  return { apiKey: env.TAVILY_API_KEY, research: true, archive };
}
