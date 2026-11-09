import type { InterruptOnConfig } from "langchain";
import type { ChatMode } from "../chat/modes";

/**
 * Plan mode is an ALLOW-list: only tools that read or ask are offered, and any other call is refused. A new or
 * third-party tool (an MCP write tool, a sandbox write) is blocked until someone adds it here on purpose.
 */
const PLAN_ALLOWED = new Set([
  // Deep Agents' own planning and read-only file tools
  "write_todos",
  "ls",
  "read_file",
  "glob",
  "grep",
  // Research and reading
  "tavily_search",
  "tavily_extract",
  "tavily_map",
  "tavily_crawl",
  "tavily_research",
  "read_document",
  "read_pdf_advanced",
  "view_image",
  // Code sandbox: look, never touch
  "sandbox_list",
  "sandbox_list_all",
  "sandbox_read",
  "sandbox_search",
  "sandbox_preview",
  // Asking and waiting
  "ask_user",
  "wait_for",
  "request_mode_switch",
  "check_background_task",
  "list_background_tasks",
  // Connected apps and workflows: reading only
  "app_find_actions",
  "app_action_details",
  "app_find_events",
  "app_read",
  "list_my_workflows",
  "get_workflow",
  "workflow_run_status",
  "list_scheduled_tasks",
  "request_app_connections",
  "admin_list_bots",
  "admin_list_groups",
]);

/** `readOnlyApps`: names of connected-app (MCP) tools that only read; they stay available in Plan mode. */
export function planAllows(name: string, readOnlyApps: readonly string[] = []) {
  return PLAN_ALLOWED.has(name) || readOnlyApps.includes(name);
}

/** Asked in every mode, even Allow all: they cost money (computer minutes) or destroy data. */
const ALWAYS_ASK = new Set(["turn_on_computer", "sandbox_delete", "admin_delete_bot", "admin_run_as_bot"]);

/** Which tools pause for the user's approval. Plan needs none: nothing that changes anything is offered. */
export function approvalsFor(
  mode: ChatMode,
  base: Record<string, InterruptOnConfig>,
): Record<string, InterruptOnConfig> {
  if (mode === "ask") return base;
  if (mode === "plan") return {};
  return Object.fromEntries(Object.entries(base).filter(([name]) => ALWAYS_ASK.has(name)));
}
