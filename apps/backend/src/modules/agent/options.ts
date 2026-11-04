import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import type { ComputerStub } from "../computer/sandbox-backend";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import type { BotApps } from "./mcp";
import type { FileToolsOptions, ViewHolder } from "./tools/files";
import type { MemoryToolsOptions } from "./tools/memory";
import type { AsyncToolOptions } from "../async-tasks/tools";
import type { SubagentToolsOptions } from "./tools/subagents";

/** The bot as the agent needs it: identity, role (its domain) and capabilities. */
export interface AgentBot {
  id: string;
  name: string;
  description: string | null;
  role: string;
  roleTitle: string | null;
  subagentsEnabled: boolean;
  maxSubagents: number;
  maxParallelTools: number;
}

export interface BuildAgentOptions {
  bot: AgentBot;
  /** The user's other bots: the prompt tells this bot where their (readable) files are. */
  peers?: Array<{ id: string; name: string }>;
  /** Must be a catalog id; the route rejects anything else. */
  modelId?: string;
  reasoningEffort?: string;
  /** Required: OpenRouter is the only model provider. */
  openrouterApiKey?: string;
  /** The model's context window in tokens (live from OpenRouter); sizes automatic summarizing. */
  contextLength?: number;
  /** The user ran /compact: this run summarizes the conversation first, to free context. */
  compact?: boolean;
  /** Hard cap on tokens per model reply. Without it OpenRouter reserves credit for the model maximum (64k+). */
  maxOutputTokens?: number;
  /** With the free router: the free vision model for calls that carry pictures (middleware/free-vision.ts). */
  freeVisionModel?: string;
  /** Web search is offered only when a key is configured. */
  tavilyApiKey?: string;
  checkpointer: BaseCheckpointSaver;
  /** Present when this run may use the user's shared computer. */
  computer?: { stub: ComputerStub; runId: string };
  /** Present when this run may use a code sandbox (coding bots). */
  sandbox?: { env: Env; db: Db; userId: string };
  /** Present when file storage is configured: image creation, view_image, and (with a computer) copy/share. */
  files?: Omit<FileToolsOptions, "botId" | "openrouterApiKey" | "vision" | "view" | "computer"> & {
    /** Images the user attached to this message: the model sees them (vision models only). */
    attached?: ViewHolder["images"];
  };
  /** Background sub-agent tasks (bots that may use sub-agents): the five async tools and their notices. */
  asyncTasks?: AsyncToolOptions;
  /** Long-term memory: the current texts for the prompt, and how to save them (agent/tools/memory). */
  memory?: { memory: string; preferences: string } & MemoryToolsOptions;
  /** The bot's installed skills as files ("/<folder>/SKILL.md", ...), from integrations/skills. */
  skills?: Record<string, string>;
  /** Tools of the bot's connected apps (MCP servers) and the ones that need approval, from agent/mcp. */
  apps?: Pick<BotApps, "tools" | "approvals" | "names" | "unavailable" | "readOnly" | "close">;
  /** What a sub-agent group may use and how to account for it; required for the sub-agent tools (bots with the capability). */
  subagents?: Pick<
    SubagentToolsOptions,
    "env" | "db" | "userId" | "threadId" | "runId" | "installedSkills" | "connectedApps" | "report" | "hub" | "sliceDeadline"
  >;
}
