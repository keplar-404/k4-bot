import { MCPAdapter } from "@langchain/mcp-adapters";
import type { CatalogMcpServer } from "../../integrations/catalog/mcp";
import { createShadcnTools } from "../tools/shadcn";
import { remoteServer } from "./servers";

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
