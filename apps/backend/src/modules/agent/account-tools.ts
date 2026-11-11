import { tool } from "langchain";
import type { InterruptOnConfig } from "langchain";
import { z } from "zod";
import { searchCatalog } from "../composio/catalog-query";
import type { Db } from "../../db";
import type { Env } from "../../config/env";
import type { BotComposioApp } from "./composio/bot-apps";
import { createComposioTools } from "./composio/tools";
import { createSecretTool } from "./secrets/request-secret";
import { createTaskTools } from "./tasks/tools";
import { createWorkflowTools } from "./workflows";

/** Server-side context for the tools that act on the user's account: connected apps, workflows, secrets. */
export type AccountOptions = { env: Env; db: Db; userId: string; apps: BotComposioApp[] };

const askFirst = (description: string): InterruptOnConfig => ({
  allowedDecisions: ["approve", "reject"],
  description,
});

/**
 * The tools that reach the user's accounts. In Ask mode the ones that act (app_act, turn_on_workflow, run_workflow)
 * pause for approval. request_secret does not: the user typing the value is the consent. In Plan mode only the
 * reading tools are offered (agent/modes.ts).
 */
export function accountTools(options: AccountOptions, botId: string) {
  const { env, db, userId } = options;
  const apps = options.apps.length > 0 ? createComposioTools(options) : null;

  // App discovery is not limited to apps the bot already has: the user can ask for any app, and the
  // bot tells them to connect it (request_app_connections) instead of inventing a toolkit name.
  const connected = new Set(options.apps.map((a) => a.toolkit));
  const findToolkits = tool(
    async ({ query }) => {
      const { items } = await searchCatalog(db, { q: query, offset: 0, limit: 10 });
      return JSON.stringify(
        items.map((t) => ({
          app: t.slug,
          name: t.name,
          what: (t.description ?? "").replace(/\s+/g, " ").slice(0, 120),
          actions: t.toolsCount,
          events: t.triggersCount,
          connected: connected.has(t.slug),
        })),
      );
    },
    {
      name: "find_toolkits",
      description:
        "Search the app catalog (Gmail, Slack, Sheets, Notion…). Returns the app slug, what it does, how many actions it has, and whether the user connected it. Use it before app_find_actions; if an app is not connected, ask the user to connect it rather than guessing.",
      schema: z.object({ query: z.string().min(1).max(80) }),
    },
  );

  const tools = [
    findToolkits,
    ...(apps?.tools ?? []),
    ...createWorkflowTools({ env, db, userId, botId }),
    ...createTaskTools({ db, userId, botId }),
    createSecretTool({ db, userId }),
  ];
  const approvals: Record<string, InterruptOnConfig> = {
    ...apps?.approvals,
    turn_on_workflow: askFirst("Turn on this workflow?"),
    run_workflow: askFirst("Run this workflow now?"),
    delete_workflow: askFirst("Delete this workflow?"),
    schedule_task: askFirst("Schedule this task?"),
    change_scheduled_task: askFirst("Change this scheduled task?"),
  };
  return { tools, approvals, appNames: apps?.appNames ?? [] };
}
