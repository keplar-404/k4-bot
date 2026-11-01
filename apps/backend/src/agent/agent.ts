import { createDeepAgent } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import type { InterruptOnConfig } from "langchain";
import { createInternetSearchTool } from "./tools/tavily-search";
import { createAuditMiddleware, type AgentEventEmitter } from "./middleware/audit-middleware";
import { DEFAULT_MODEL_ID, resolveModel } from "./models";

export interface BuildAgentOptions {
  bot: { name: string; description: string | null };
  /** Must be a catalog id; the route rejects anything else. */
  modelId?: string;
  reasoningEffort?: string;
  /** Required: OpenRouter is the only model provider. */
  openrouterApiKey?: string;
  /** Web search is offered only when a key is configured. */
  tavilyApiKey?: string;
  checkpointer: BaseCheckpointSaver;
  emit: AgentEventEmitter;
}

/** Built-in filesystem mutations pause the run until the user decides. */
const interruptOn: Record<string, InterruptOnConfig> = {
  write_file: { allowedDecisions: ["approve", "edit", "reject"] },
  edit_file: { allowedDecisions: ["approve", "edit", "reject"] },
};

export function buildAgent(options: BuildAgentOptions) {
  const { bot, openrouterApiKey, tavilyApiKey, checkpointer, emit } = options;
  if (!openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured; the agent has no model to call.");
  }

  const model = resolveModel(options.modelId ?? DEFAULT_MODEL_ID);
  if (!model) throw new Error(`Unknown model: ${options.modelId}`);
  const effort =
    model.reasoning && options.reasoningEffort && model.reasoningEfforts.includes(options.reasoningEffort)
      ? options.reasoningEffort
      : undefined;

  // OpenRouter speaks the OpenAI protocol; LangChain JS cannot infer the
  // provider from an "openrouter:..." string, so the client is built explicitly.
  const chatModel = new ChatOpenAI({
    model: model.id,
    apiKey: openrouterApiKey,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "https://k4.bot", "X-Title": "K4 Bot" },
    },
    ...(effort ? { modelKwargs: { reasoning: { effort } } } : {}),
  });

  return createDeepAgent({
    model: chatModel,
    tools: tavilyApiKey ? [createInternetSearchTool(tavilyApiKey)] : [],
    middleware: [createAuditMiddleware(emit)],
    systemPrompt:
      `You are "${bot.name}", a helpful AI assistant.` +
      (bot.description ? `\nAbout you: ${bot.description}` : "") +
      "\n\nUse the available tools when they help you answer accurately. Write todos for multi-step tasks.",
    interruptOn,
    checkpointer,
  });
}
