import type { ExpressionId } from "@/features/avatar/bloub/bot/expressions";
import type { ColorId, ShapeId } from "@/features/avatar/bloub/bot/skins";
import type { RoleId } from "@/features/bots/roles";

export type Bot = {
  id: string;
  name: string;
  description: string | null;
  /** What the bot is for (see modules/bots/roles.ts). Older responses may omit it: treat as "assistant". */
  role?: string;
  /** The user's own title when role is "custom". */
  roleTitle?: string | null;
  /** Installed skills (user_skill ids) and connected apps (user_mcp_server ids) the bot uses. */
  skillIds?: string[];
  mcpServerIds?: string[];
  /** Capabilities: sub-agent groups and parallel tool calls. */
  subagentsEnabled?: boolean;
  maxSubagents?: number;
  maxParallelTools?: number;
  shape: string;
  color: string;
  expression: string;
  /** The model picked for this bot in the prompt bar; null = the catalog default. */
  modelId?: string | null;
  reasoningEffort?: string | null;
};

export type BotsResult =
  | { ok: true; bots: Bot[] }
  | { ok: false; status: number };

/** One bot per id, same TTL: the bot page reads only its own bot instead of the whole list. */
export type BotResult = { ok: true; bot: Bot } | { ok: false; status: number };

export type CreateBotInput = {
  name: string;
  description?: string;
  role?: RoleId;
  roleTitle?: string;
  skillIds?: string[];
  mcpServerIds?: string[];
  subagentsEnabled?: boolean;
  maxSubagents?: number;
  maxParallelTools?: number;
  shape: ShapeId;
  color: ColorId;
  expression: ExpressionId;
};

export class BotApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BotApiError";
    this.status = status;
  }
}
