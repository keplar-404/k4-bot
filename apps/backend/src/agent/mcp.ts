import type { StructuredToolInterface } from "@langchain/core/tools";
import { MCPAdapter } from "@langchain/mcp-adapters";
import { and, eq } from "drizzle-orm";
import type { InterruptOnConfig } from "langchain";
import type { Db } from "../db";
import { botMcpServer, userMcpServer } from "../db/schema";
import { catalogMcp, type CatalogMcpServer } from "../lib/catalog/mcp";
import type { Env } from "../lib/env";
import { decryptSecret } from "../lib/secrets";
import { createShadcnTools } from "./tools/shadcn";

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

function remoteServer(entry: CatalogMcpServer, secrets: Record<string, string>) {
  return { url: entry.url!, headers: entry.headers?.(secrets) ?? {}, defaultToolTimeout: TOOL_TIMEOUT_MS };
}

/** The connected apps a bot may use (see connectApps). */
export async function connectBotApps(env: Env, db: Db, userId: string, botId: string): Promise<BotApps> {
  const rows = await db
    .select({ id: userMcpServer.id, serverId: userMcpServer.serverId, secrets: userMcpServer.secrets })
    .from(botMcpServer)
    .innerJoin(userMcpServer, eq(userMcpServer.id, botMcpServer.userMcpServerId))
    .where(and(eq(botMcpServer.botId, botId), eq(userMcpServer.userId, userId)));
  return connectApps(env, userId, rows);
}

/**
 * Connected apps as LangChain tools. Secrets are decrypted here, on the server, only for this run; they go in
 * request headers to the vendor and nowhere else. A server that fails to connect is skipped so one bad token never
 * stops the run.
 */
export async function connectApps(env: Env, userId: string, rows: AppConnection[]): Promise<BotApps> {
  const tools: StructuredToolInterface[] = [];
  const approvals: Record<string, InterruptOnConfig> = {};
  const unavailable: string[] = [];
  const servers: Record<string, ReturnType<typeof remoteServer>> = {};
  const remote: CatalogMcpServer[] = [];
  const names = rows.flatMap((r) => catalogMcp(r.serverId)?.name ?? []);
  const readOnly: Record<string, StructuredToolInterface[]> = {};

  for (const row of rows) {
    const entry = catalogMcp(row.serverId);
    if (!entry) continue;
    if (entry.kind === "builtin") {
      if (entry.id === "shadcn") {
        const own = createShadcnTools();
        tools.push(...own);
        readOnly[entry.id] = own;
      }
      continue;
    }
    try {
      const secrets = row.secrets ? (JSON.parse(await decryptSecret(env, row.secrets, mcpSecretContext(userId, row.id))) as Record<string, string>) : {};
      servers[entry.id] = remoteServer(entry, secrets);
      remote.push(entry);
    } catch {
      unavailable.push(entry.name);
    }
  }

  if (remote.length === 0) return { tools, approvals, names, unavailable, readOnly, close: async () => undefined };

  const adapter = new MCPAdapter({
    servers,
    // Returning normally skips this server and keeps the others.
    onConnectionError: ({ serverName, error }) => {
      unavailable.push(catalogMcp(serverName)?.name ?? serverName);
      console.warn("[mcp] connection failed", serverName, String((error as Error)?.message ?? error).slice(0, 200));
    },
  });
  try {
    const toolsets = await adapter.listToolsets();
    for (const entry of remote) {
      readOnly[entry.id] = [];
      for (const t of toolsets[entry.id] ?? []) {
        tools.push(t);
        if (entry.approval?.test(t.name)) approvals[t.name] = { allowedDecisions: ["approve", "reject"], description: `${entry.name}: ${t.name.slice(entry.id.length + 1).replace(/_/g, " ")}` };
        else readOnly[entry.id]!.push(t);
      }
    }
  } catch (error) {
    console.warn("[mcp] discovery failed", String((error as Error)?.message ?? error).slice(0, 200));
    unavailable.push(...remote.map((e) => e.name).filter((n) => !unavailable.includes(n)));
  }
  return { tools, approvals, names, unavailable, readOnly, close: () => adapter.close().catch(() => undefined) };
}

/**
 * Checks a token before it is saved: connects and lists the server's tools (one call to the vendor).
 * Returns the tool names, or a message for the user.
 */
export async function testConnection(entry: CatalogMcpServer, secrets: Record<string, string>): Promise<{ ok: true; tools: string[] } | { ok: false; message: string }> {
  if (entry.kind === "builtin") return { ok: true, tools: entry.id === "shadcn" ? createShadcnTools().map((t) => t.name) : [] };
  const adapter = new MCPAdapter({ servers: { [entry.id]: remoteServer(entry, secrets) } });
  try {
    const tools = await adapter.listTools();
    return { ok: true, tools: tools.map((t) => t.name) };
  } catch (error) {
    const text = String((error as Error)?.message ?? error);
    return {
      ok: false,
      message: /401|403|unauthori[sz]ed|forbidden|invalid_token/i.test(text)
        ? `${entry.name} rejected this token. Check that it is correct and has the scopes listed.`
        : `Could not reach ${entry.name}. Try again in a moment.`,
    };
  } finally {
    await adapter.close().catch(() => undefined);
  }
}
