import { MCPAdapter } from "@langchain/mcp-adapters";
import type { CatalogMcpServer } from "../../integrations/catalog/mcp";
import { createShadcnTools } from "../tools/shadcn";
import { remoteServer } from "./servers";

/**
 * A real round trip to the app, never a canned answer: a remote MCP server is connected and asked for its tools
 * (MCP `initialize` + `tools/list`); the built-in shadcn app runs one real registry search. Used before a token is
 * saved and by the Test button. Returns the tool names and how long it took, or a message for the user.
 */
export async function testConnection(
  entry: CatalogMcpServer,
  secrets: Record<string, string>,
): Promise<{ ok: true; tools: string[]; ms: number } | { ok: false; message: string }> {
  const started = Date.now();
  if (entry.kind === "builtin") {
    if (entry.id !== "shadcn") return { ok: true, tools: [], ms: 0 };
    const tools = createShadcnTools();
    try {
      const found = String(await tools.find((t) => t.name === "shadcn_search_items")!.invoke({ query: "button", limit: 1 }));
      if (found.startsWith("Nothing matches")) return { ok: false, message: "The shadcn registry answered, but returned no items." };
      return { ok: true, tools: tools.map((t) => t.name), ms: Date.now() - started };
    } catch {
      return { ok: false, message: "Could not reach the shadcn registry (ui.shadcn.com). Try again in a moment." };
    }
  }
  const adapter = new MCPAdapter({ servers: { [entry.id]: remoteServer(entry, secrets) } });
  try {
    const tools = await adapter.listTools();
    return { ok: true, tools: tools.map((t) => t.name), ms: Date.now() - started };
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
