import { ChatOpenRouter } from "@langchain/openrouter";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { CompositeBackend, StateBackend, createDeepAgent } from "deepagents";
import { piiMiddleware, toolErrorMiddleware, type InterruptOnConfig } from "langchain";
import { botHome, botUnixUser } from "../computer/guards";
import { createScreenMiddleware } from "../computer/screen-middleware";
import { ComputerSandbox, type ComputerStub } from "../computer/sandbox-backend";
import { createComputerTools, type ScreenHolder } from "../computer/tools";
import { DEFAULT_MODEL_ID, resolveModel } from "./models";
import { systemPrompt } from "./prompts/system";
import { createInternetSearchTool } from "./tools/tavily-search";

export interface BuildAgentOptions {
  bot: { id: string; name: string; description: string | null };
  /** Must be a catalog id; the route rejects anything else. */
  modelId?: string;
  reasoningEffort?: string;
  /** Required: OpenRouter is the only model provider. */
  openrouterApiKey?: string;
  /** Hard cap on tokens per model reply. Without it OpenRouter reserves credit for the model maximum (64k+). */
  maxOutputTokens?: number;
  /** Web search is offered only when a key is configured. */
  tavilyApiKey?: string;
  checkpointer: BaseCheckpointSaver;
  /** Present when this run may use the user's shared computer. */
  computer?: { stub: ComputerStub; runId: string };
}

/**
 * Human-in-the-loop (Deep Agents `interruptOn`): the run pauses before these tools run and the
 * chat shows Approve / Reject. https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop
 *
 * Without a computer, file writes go to a virtual filesystem and still ask first. With one, the
 * bot's files live in its own Linux account; what needs the user is waking or sleeping the shared
 * computer (it costs computer time, and sleeping it stops the user's other bots too).
 */
const fileApprovals: Record<string, InterruptOnConfig> = {
  write_file: { allowedDecisions: ["approve", "edit", "reject"] },
  edit_file: { allowedDecisions: ["approve", "edit", "reject"] },
};
const computerApprovals: Record<string, InterruptOnConfig> = {
  turn_on_computer: { allowedDecisions: ["approve", "reject"], description: "Turn on your computer?" },
  turn_off_computer: { allowedDecisions: ["approve", "reject"], description: "Turn off your computer? Its work is saved." },
};

export function buildAgent(options: BuildAgentOptions) {
  const { bot, openrouterApiKey, tavilyApiKey, checkpointer, computer } = options;
  if (!openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured; the agent has no model to call.");
  }

  const model = resolveModel(options.modelId ?? DEFAULT_MODEL_ID);
  if (!model) throw new Error(`Unknown model: ${options.modelId}`);
  const effort =
    model.reasoning && options.reasoningEffort && model.reasoningEfforts.includes(options.reasoningEffort)
      ? options.reasoningEffort
      : undefined;

  // Every model comes from OpenRouter, through LangChain's own OpenRouter integration.
  // `modelKwargs` is merged into the request body, which is where OpenRouter reads `reasoning`.
  const chatModel = new ChatOpenRouter({
    model: model.id,
    apiKey: openrouterApiKey,
    maxTokens: options.maxOutputTokens ?? 8192,
    siteUrl: "https://k4.bot",
    siteName: "K4 Bot",
    ...(effort ? { modelKwargs: { reasoning: { effort } } } : {}),
  });

  const unix = botUnixUser(bot.id);
  const screen: ScreenHolder = {};
  const computerTools = computer
    ? createComputerTools({ computer: computer.stub, botId: bot.id, runId: computer.runId, screen })
    : [];
  // Without vision the model cannot use the screen, so it is not offered the mouse and keyboard.
  const tools = [
    ...(tavilyApiKey ? [createInternetSearchTool(tavilyApiKey)] : []),
    ...computerTools.filter((t) => model.vision || t.name !== "computer"),
  ];

  return createDeepAgent({
    model: chatModel,
    tools,
    // The sandbox is the default backend (so the agent gets `execute`); Deep Agents' own scratch
    // files stay in ephemeral state instead of landing on the VM disk.
    ...(computer && unix.ok
      ? {
          backend: new CompositeBackend(new ComputerSandbox(computer.stub, bot.id), {
            "/large_tool_results/": new StateBackend(),
            "/conversation_history/": new StateBackend(),
          }),
        }
      : {}),
    middleware: [
      // Outermost: a failed tool call becomes an error message the agent can react to, not a dead run.
      // Pause/interrupt signals are never converted.
      toolErrorMiddleware({
        onError: (error, request) =>
          `Tool '${request.toolCall.name}' failed: ${String((error as Error)?.message ?? error)
            .split("\n")[0]
            ?.slice(0, 200)}`,
      }),
      // LangChain's built-in PII guardrails: the model never sees card numbers or key-shaped secrets,
      // whether typed by the user or returned by a web page or the shell.
      piiMiddleware("credit_card", { strategy: "redact", applyToInput: true, applyToToolResults: true }),
      piiMiddleware("api_key", {
        detector: /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})/,
        strategy: "redact",
        applyToInput: true,
        applyToToolResults: true,
      }),
      ...(computer ? [createScreenMiddleware(screen, computer.stub)] : []),
    ],
    systemPrompt: systemPrompt({
      bot,
      computer: computer && unix.ok ? { home: botHome(unix.value), canSee: model.vision } : undefined,
    }),
    interruptOn: computer ? computerApprovals : fileApprovals,
    checkpointer,
  });
}
