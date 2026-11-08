import { tool } from "langchain";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { isRead } from "../../composio/action-kind";
import { composioFor, TOOLKIT_SLUG } from "../../composio/client";
import { getTool, listTools } from "../../composio/tools";
import type { BotComposioApp } from "./bot-apps";

const MAX_SCHEMA_CHARS = 8000;
const MAX_MATCHES = 15;

export const appField = z.string().regex(TOOLKIT_SLUG).describe("The app, e.g. gmail.");
export const actionField = z
  .string()
  .regex(/^[A-Z0-9_]{1,120}$/)
  .describe("An action slug from app_find_actions.");

export const notEnabled = (toolkit: string) => `${toolkit} is not enabled for this bot.`;

/** The two tools that only look things up: find an action of an app, and see what an action takes. */
export function createLookupTools(env: Env, enabled: Map<string, BotComposioApp>) {
  const findActions = tool(
    async ({ app, query }) => {
      if (!enabled.has(app)) return notEnabled(app);
      const words = query.toLowerCase();
      const all = await listTools(composioFor(env), app);
      const matches = all
        .filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(words))
        .slice(0, MAX_MATCHES)
        .map(({ slug, name, description }) => ({ slug, name, description }));
      return JSON.stringify(matches);
    },
    {
      name: "app_find_actions",
      description: `Search the actions of an enabled app (up to ${MAX_MATCHES}).`,
      schema: z.object({ app: appField, query: z.string().max(200) }),
    },
  );

  const actionDetails = tool(
    async ({ action }) => {
      const details = await getTool(composioFor(env), action);
      if (!details.toolkit) return "Unknown action.";
      if (!enabled.has(details.toolkit)) return notEnabled(details.toolkit);
      const tooLarge = JSON.stringify(details.input).length > MAX_SCHEMA_CHARS;
      return JSON.stringify({
        slug: action,
        version: details.version,
        readOnly: isRead(action, details.toolkit, details.tags),
        input: tooLarge ? "too large: pass only the required fields" : details.input,
      });
    },
    {
      name: "app_action_details",
      description: "What an action needs (its input schema) and whether it only reads.",
      schema: z.object({ action: actionField }),
    },
  );

  return [findActions, actionDetails] as const;
}
