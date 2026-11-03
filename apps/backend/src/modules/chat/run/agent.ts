import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import { buildAgent, type BuildAgentOptions } from "../../agent/agent";
import { NeonHttpCheckpointer } from "../../agent/checkpointer/neon-http-checkpointer";
import type { RunStream } from "../../agent/run-stream";
import type { ComputerStub } from "../../computer/sandbox-backend";
import { fileOptions } from "./context";
import type { ChatRunParams } from "./types";

type Streamable = { streamEvents(input: unknown, config: object): Promise<RunStream & { abort?: () => void }> };

/** The bot's agent for one slice, with this run's model, keys, computer and files. */
export function buildRunAgent(
  env: Env,
  db: Db,
  params: ChatRunParams,
  parts: Pick<BuildAgentOptions, "bot" | "skills" | "apps" | "subagents" | "peers" | "contextLength"> & { stub?: ComputerStub; images: Array<{ name: string; dataUrl: string }> },
): Streamable {
  const { stub, images, ...rest } = parts;
  return buildAgent({
    ...rest,
    modelId: params.modelId,
    reasoningEffort: params.reasoningEffort,
    compact: params.compact,
    openrouterApiKey: env.OPENROUTER_API_KEY,
    tavilyApiKey: env.TAVILY_API_KEY,
    maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    checkpointer: new NeonHttpCheckpointer(db),
    ...(stub ? { computer: { stub, runId: params.runId } } : {}),
    files: fileOptions(env, db, params, images),
  }) as unknown as Streamable;
}
