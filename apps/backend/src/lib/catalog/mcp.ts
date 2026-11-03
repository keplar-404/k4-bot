/**
 * The MCP servers (connected apps) users can add. Two kinds:
 *  - "remote": the vendor's own hosted MCP server, reached over Streamable HTTP from the Worker.
 *  - "builtin": tools this platform runs itself, for a service whose official MCP server only runs locally
 *    (a Worker cannot start local processes).
 */
export interface McpSecretField {
  key: string;
  label: string;
  placeholder?: string;
  /** How to get it, shown under the input. */
  help: string;
  helpUrl?: string;
}

export interface CatalogMcpServer {
  /** Also the tool name prefix ("airtable_list_records"): short, lowercase, no dots or spaces. */
  id: string;
  name: string;
  publisher: string;
  /** Which bot roles it suits best (the UI suggests it to them). */
  roles: string[];
  summary: string;
  description: string;
  /** What a bot can do with it, for the details page. */
  capabilities: string[];
  website: string;
  docsUrl: string;
  kind: "remote" | "builtin";
  /** Remote servers only. */
  url?: string;
  /** Secrets the user must give. Encrypted at rest; only the server ever sees them in clear. */
  fields: McpSecretField[];
  /** Remote servers only: the request headers, built from the decrypted secrets. */
  headers?: (secrets: Record<string, string>) => Record<string, string>;
  /** Tools whose names match need the user's approval in the chat before they run (they change real data). */
  approval?: RegExp;
}

export const MCP_CATALOG: CatalogMcpServer[] = [
  {
    id: "airtable",
    name: "Airtable",
    publisher: "Airtable (official)",
    roles: ["assistant", "research", "advisor"],
    summary: "Read and update your Airtable bases, tables and records.",
    description:
      "Airtable's official hosted MCP server. Your bots can list your bases and tables, search and read records, and create or update records and fields. Changes to your data are confirmed with you in the chat first.",
    capabilities: ["List bases, tables and fields", "Search and read records", "Create and update records (asks you first)", "Read and add record comments"],
    website: "https://airtable.com",
    docsUrl: "https://airtable.com/developers/agents/mcp/cursor",
    kind: "remote",
    url: "https://mcp.airtable.com/mcp",
    fields: [
      {
        key: "token",
        label: "Personal access token",
        placeholder: "pat…",
        help: "Create one in Airtable's developer hub with the scopes data.records:read, data.records:write, schema.bases:read and workspacesAndBases:read, and pick the bases your bots may use.",
        helpUrl: "https://airtable.com/create/tokens",
      },
    ],
    headers: (s) => ({ Authorization: `Bearer ${s.token}` }),
    approval: /(create|update|delete|upsert|write|add|remove|comment)/i,
  },
  {
    id: "shadcn",
    name: "shadcn/ui",
    publisher: "shadcn/ui registry",
    roles: ["coding"],
    summary: "Browse, search and get the code of shadcn/ui components, blocks and examples.",
    description:
      "Gives your bots the shadcn/ui registry: search components, blocks and examples, read their source and dependencies, and get the exact install command. The official shadcn MCP server only runs on a local machine, so this platform serves the same registry data itself. Free, no key needed.",
    capabilities: ["Search components, blocks and examples", "Read a component's source and dependencies", "Find usage examples", "Get the shadcn add command"],
    website: "https://ui.shadcn.com",
    docsUrl: "https://ui.shadcn.com/docs/mcp",
    kind: "builtin",
    fields: [],
  },
];

export const catalogMcp = (id: string) => MCP_CATALOG.find((s) => s.id === id);

/** The catalog as the browser sees it: no functions, no patterns. */
export const publicMcp = ({ headers: _h, approval: _a, url: _u, ...rest }: CatalogMcpServer) => rest;
