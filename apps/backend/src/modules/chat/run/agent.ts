import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import { buildAgent, type BuildAgentOptions } from "../../agent/agent";
import { NeonHttpCheckpointer } from "../../agent/checkpointer/neon-http-checkpointer";
import type { RunStream } from "../../agent/run-stream";
import type { ComputerStub } from "../../computer/sandbox-backend";
import { pgBudgetStore } from "../../agent/tools/web/budget";
import { type WebAccess, webAccess } from "../../agent/tools/web";
import { fileOptions } from "./context";
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
  parts: Pick<BuildAgentOptions, "bot" | "skills" | "apps" | "subagents" | "peers" | "contextLength" | "memory"> & { stub?: ComputerStub; images: Array<{ name: string; dataUrl: string }> },
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
    web: withResearch(webAccess(env, pgBudgetStore(db), { userId: params.userId, runId: params.runId }), params.research),
    maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    checkpointer: new NeonHttpCheckpointer(db),
    ...(stub ? { computer: { stub, runId: params.runId } } : {}),
    ...(isCoding ? { sandbox: { env, db, userId: params.userId } } : {}),
    asyncTasks: { env, threadId: params.threadId, userId: params.userId, botName: parts.bot.name, modelId: params.modelId },
    files: fileOptions(env, db, params, images),
  }) as unknown as Streamable;
}

/** tavily_research is offered only in a run the user started with /deep-research. */
const withResearch = (web: WebAccess | undefined, research?: boolean) => (web ? { ...web, research: Boolean(research) } : undefined);
