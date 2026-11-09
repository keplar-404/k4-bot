import type { InterruptOnConfig } from "langchain";
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

  const tools = [
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
