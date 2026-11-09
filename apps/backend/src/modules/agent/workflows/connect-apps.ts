import { interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";
import { missingApps } from "../../composio/requirements";
import type { WorkflowToolContext } from "./common";

/**
 * The bot asks the user to connect the apps a task needs. The chat shows a card with each app's logo, name and a
 * Connect button; the run waits until the user comes back. Afterwards the server checks again, so the bot learns
 * which apps really are connected (never what the user said).
 */
export const createConnectAppsTool = ({ env, db, userId }: WorkflowToolContext) =>
  tool(
    async ({ toolkits, why }) => {
      const missing = await missingApps(env, db, userId, toolkits);
      if (missing.length === 0) return "All of these apps are connected.";
      const names = missing.map((a) => a.name).join(", ");
      interrupt({ kind: "connect_apps", question: `Connect ${names} to continue`, why, apps: missing });
      const still = await missingApps(env, db, userId, toolkits);
      if (still.length === 0) return `The user connected ${names}. Continue.`;
      return `Still not connected: ${still.map((a) => a.name).join(", ")}. Do not use them; tell the user what cannot be done without them.`;
    },
    {
      name: "request_app_connections",
      description:
        "Ask the user to connect apps (by Composio toolkit slug, e.g. googlesheets) that a workflow or task needs. Shows a card with Connect buttons and waits. Call it before building or turning on a workflow that uses apps the user has not connected; create_workflow and turn_on_workflow tell you which ones are missing.",
      schema: z.object({
        toolkits: z.array(z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)).min(1).max(20),
        why: z.string().max(300).describe("One sentence for the user: what these apps are needed for."),
      }),
    },
  );
