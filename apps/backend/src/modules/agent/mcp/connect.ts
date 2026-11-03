import type { StructuredToolInterface } from "@langchain/core/tools";
import { MCPAdapter } from "@langchain/mcp-adapters";
import { and, eq } from "drizzle-orm";
import type { InterruptOnConfig } from "langchain";
import type { Db } from "../../../db";
import { botMcpServer, userMcpServer } from "../../../db/schema";
import { catalogMcp, type CatalogMcpServer } from "../../integrations/catalog/mcp";
import type { Env } from "../../../config/env";
import { decryptSecret } from "../../../shared/secrets";
import { createShadcnTools } from "../tools/shadcn";
import { type AppConnection, type BotApps, mcpSecretContext, remoteServer } from "./servers";

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

