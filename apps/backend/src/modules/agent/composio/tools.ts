import { type InterruptOnConfig, tool } from "langchain";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { isRead } from "../../composio/action-kind";
import { composioFor } from "../../composio/client";
import { executeAction } from "../../composio/execute";
import { getTool } from "../../composio/tools";
import type { BotComposioApp } from "./bot-apps";
import { actionField, appField, createLookupTools, notEnabled } from "./lookup-tools";

const MAX_RESULT_CHARS = 16 * 1024;

const argumentsField = z.record(z.string().max(100), z.unknown()).optional();

/**
 * A bot's connected apps (Composio) as four small tools: find an action, see what it takes, run a read-only one,
 * and run any one. Thousands of action schemas never enter the model's context.
 */
export function createComposioTools(opts: { env: Env; userId: string; apps: BotComposioApp[] }) {
  const { env, userId } = opts;
  const enabled = new Map(opts.apps.map((app) => [app.toolkit, app]));

  async function runAction(app: BotComposioApp, slug: string, input: Record<string, unknown> = {}) {
    const result = await executeAction(env, {
      userId,
      toolkit: app.toolkit,
      slug,
      arguments: input,
      connectedAccountId: app.connectedAccountId,
      maxChars: MAX_RESULT_CHARS,
    });
    return JSON.stringify(result.ok ? { data: result.data } : { error: result.error });
  }

  const [findActions, actionDetails, findEvents] = createLookupTools(env, enabled);

  const readAction = tool(
    async ({ app, action, arguments: input }) => {
      const enabledApp = enabled.get(app);
      if (!enabledApp) return notEnabled(app);
      const details = await getTool(composioFor(env), action);
      if (details.toolkit !== app) return `${action} is not an action of ${app}.`;
      // Plan mode offers this tool, so it must never change anything: unknown actions count as writes.
      if (!isRead(action, app, details.tags)) return "That action changes data. Use app_act for it.";
      return runAction(enabledApp, action, input);
    },
    {
      name: "app_read",
      description: "Run a read-only action. Anything that changes data is refused: use app_act.",
      schema: z.object({ app: appField, action: actionField, arguments: argumentsField }),
    },
  );

  const act = tool(
    async ({ app, action, arguments: input }) => {
      const enabledApp = enabled.get(app);
      if (!enabledApp) return notEnabled(app);
      if (!enabledApp.allowWrites) return `This bot may only read in ${app}.`;
      return runAction(enabledApp, action, input);
    },
    {
      name: "app_act",
      description:
        "Run any action of an enabled app, including ones that send or change things. The user may be asked first; `summary` is what they see.",
      schema: z.object({
        app: appField,
        action: actionField,
        arguments: argumentsField,
        summary: z.string().max(200).describe("One line for the user: what this does, to whom."),
      }),
    },
  );

  const approvals: Record<string, InterruptOnConfig> = {
    app_act: { allowedDecisions: ["approve", "reject"], description: "Let the bot use an app?" },
  };
  return {
    tools: [findActions, actionDetails, findEvents, readAction, act],
    approvals,
    appNames: [...enabled.keys()],
  };
}
