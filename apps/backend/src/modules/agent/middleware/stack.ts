import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AnyBackendProtocol } from "deepagents";
import { type AgentMiddleware, piiMiddleware } from "langchain";
import type { ComputerStub } from "../../computer/sandbox-backend";
import { createScreenMiddleware } from "../../computer/screen-middleware";
import type { ScreenHolder } from "../../computer/tools";
import type { ViewHolder } from "../tools/files";
import type { GroupHub } from "../tools/subagents";
import { createViewMiddleware } from "../view-middleware";
import { createFreeVisionMiddleware } from "./free-vision";
import { createGroupGuardMiddleware, createHideToolsMiddleware } from "./hide-tools";
import { createParallelToolsMiddleware } from "./parallel-tools";
import { createSummarizeMiddleware } from "./summarize";
import { createTodoGuardMiddleware } from "./todo-guard";
import { createToolErrorsMiddleware } from "./tool-errors";
import { createToolRetryMiddleware } from "./tool-retry";

/** The bot's middleware, outermost first. Each entry is present only when the run has what it guards. */
export function botMiddleware(options: {
  botId: string;
  maxParallelTools: number;
  /** Tools that would pause the run: hidden while a sub-agent group of this run works. */
  pausing?: { hub: GroupHub; names: string[] };
  computer?: { stub: ComputerStub; screen: ScreenHolder };
  view?: ViewHolder;
  /** Summarizes the conversation at 80% of the context window, and at once with `now` (/compact). */
  summarize: { model: BaseChatModel; backend: AnyBackendProtocol; now?: boolean };
  /** Present with the free router: calls carrying pictures go to this vision model. */
  freeVision?: BaseChatModel;
  /** Read-only tools of the bot's connected apps: safe to retry. */
  appReadOnlyTools?: string[];
  /** Feature middleware that only some bots get (background-task notices), added after the guards. */
  extra?: AgentMiddleware[];
}) {
  return [
    // Outermost: a failed tool call becomes an error message the agent can react to, not a dead run.
    createToolErrorsMiddleware(),
    // Read-only tools get two more tries on a transient failure (tool-retry.ts lists which).
    createToolRetryMiddleware(options.appReadOnlyTools),
    createSummarizeMiddleware(options.summarize),
    // Deep Agents' built-in `task` sub-agent is hidden: sub-agents are the spawn_subagents capability, given on purpose.
    createHideToolsMiddleware(["task"]),
    // At most this many tool calls of one step run at the same time; the rest wait their turn.
    createParallelToolsMiddleware(options.maxParallelTools),
    // A run that stops with unfinished todos is sent back once or twice; a long one verifies before answering.
    createTodoGuardMiddleware(),
    // While a sub-agent group runs, nothing may pause the run (an approval or a question would end the step and the
    // group with it), and only one group runs at a time.
    ...(options.pausing ? [createGroupGuardMiddleware(options.pausing.hub, options.pausing.names)] : []),
    ...(options.extra ?? []),
    // LangChain's built-in PII guardrails: the model never sees card numbers or key-shaped secrets,
    // whether typed by the user or returned by a web page or the shell.
    piiMiddleware("credit_card", { strategy: "redact", applyToInput: true, applyToToolResults: true }),
    piiMiddleware("api_key", {
      detector: /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})/,
      strategy: "redact",
      applyToInput: true,
      applyToToolResults: true,
    }),
    ...(options.computer ? [createScreenMiddleware(options.computer.screen, options.computer.stub, options.botId)] : []),
    ...(options.view ? [createViewMiddleware(options.view)] : []),
    // Innermost: it must see the pictures the two middleware above add.
    ...(options.freeVision ? [createFreeVisionMiddleware(options.freeVision)] : []),
  ];
}
