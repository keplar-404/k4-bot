import type { StructuredToolInterface } from "@langchain/core/tools";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Db } from "../../../../db";
import type { Env } from "../../../../config/env";
import type { InstalledSkillRef } from "../../../integrations/skills";
import type { AppConnection, BotApps } from "../../mcp";
import type { SubagentStatus } from "../../parts";
import type { GroupHub } from "./hub";

/**
 * How many members run at the same time. A Worker keeps at most 6 outgoing connections open, so more would only
 * queue inside the runtime; the rest of a group starts as earlier ones finish.
 */
export const CONCURRENCY = 6;
export const MEMBER_TIMEOUT_MS = 8 * 60_000;
/** A group ends at most this long after it starts, and always a minute before the run segment's own limit. */
export const GROUP_MAX_MS = 14 * 60_000;
/** One report in the lead's context. Longer tool results are moved to a file by the harness anyway. */
export const MAX_REPORT_CHARS = 12_000;

export interface SubagentToolsOptions {
  env: Env;
  db: Db;
  userId: string;
  threadId: string;
  runId: string;
  modelId: string;
  /** A fresh chat model for each sub-agent (same model as the bot). */
  createModel: () => BaseChatModel;
  botName: string;
  maxAgents: number;
  maxParallelTools: number;
  today: string;
  /** The domain's brief for its sub-agents (e.g. the researcher playbook). */
  brief?: string;
  /** The lead's web tools (same spend guard), given to every member. */
  webTools: StructuredToolInterface[];
  /** Every skill the user installed (the lead may give any of them). */
  installedSkills: Array<InstalledSkillRef & { description: string }>;
  /** Every app the user connected (the lead may give any of them; sub-agents get read-only tools). */
  connectedApps: Array<AppConnection & { name: string }>;
  /** The bot's own app connections, reused instead of connecting twice. */
  botApps?: BotApps;
  /** The run segment's groups. */
  hub: GroupHub;
  /** When the run segment must end (epoch ms): groups end before it. */
  sliceDeadline: number;
  /** Saves files into the lead's workspace under `dir` (the computer when it is on); returns where they went, or null when they could not be saved. */
  saveFiles: (dir: string, files: Record<string, string>, options: { workspace: boolean }) => Promise<string | null>;
  /** Live status for the chat. */
  report?: (toolCallId: string, agents: SubagentStatus[]) => Promise<void>;
}
