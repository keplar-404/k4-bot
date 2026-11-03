import type { StructuredToolInterface } from "@langchain/core/tools";
import type { InterruptOnConfig } from "langchain";
import type { CatalogMcpServer } from "../../integrations/catalog/mcp";

/** One MCP tool call may take this long (remote servers can be slow on big tables). */
const TOOL_TIMEOUT_MS = 60_000;

export const mcpSecretContext = (userId: string, connectionId: string) => ({ userId, recordId: connectionId, purpose: "mcp" });

export interface BotApps {
  tools: StructuredToolInterface[];
  /** Tools that change the user's data: the chat asks before each call. */
  approvals: Record<string, InterruptOnConfig>;
  /** Every app the bot has, by display name, for the prompt. */
  names: string[];
  /** Apps that could not be reached this time, for the prompt (so the bot can say so instead of guessing). */
  unavailable: string[];
  /** Each app's tools that only read (no approval needed), by catalog id: what a sub-agent may be given. */
  readOnly: Record<string, StructuredToolInterface[]>;
  close(): Promise<void>;
}

export type AppConnection = { id: string; serverId: string; secrets: string | null };

export function remoteServer(entry: CatalogMcpServer, secrets: Record<string, string>) {
  return { url: entry.url!, headers: entry.headers?.(secrets) ?? {}, defaultToolTimeout: TOOL_TIMEOUT_MS };
}

