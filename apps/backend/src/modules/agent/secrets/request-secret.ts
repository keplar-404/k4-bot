import { interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";
import type { Db } from "../../../db";
import { SECRET_NAME, secretExists } from "../../secrets/store";

/**
 * The bot asks the user for an API key or private value through a secure form. The value goes from the browser straight to
 * PUT /secrets/:name (encrypted), never through the chat, a run event or the model: the bot is only told it was saved.
 * After the answer the server checks the row exists, so a forged "saved" does nothing.
 */
export const createSecretTool = (opts: { db: Db; userId: string }) =>
  tool(
    async ({ name, label, why }) => {
      if (await secretExists(opts.db, opts.userId, name))
        return `Already saved. Use it as {{secrets.${name}}} in workflow fields.`;
      const reply = interrupt({ kind: "secret", name, label, why, question: `Enter ${label}` });
      if (reply === "saved" && (await secretExists(opts.db, opts.userId, name)))
        return `The user saved ${name}. Use it as {{secrets.${name}}} in workflow fields.`;
      return `The user did not provide ${name}.`;
    },
    {
      name: "request_secret",
      description:
        "Ask the user to enter an API key or other private value in a secure form. You never see the value; you only learn it was saved.",
      schema: z.object({
        name: z.string().regex(SECRET_NAME).describe("UPPER_SNAKE_CASE name, e.g. STRIPE_API_KEY."),
        label: z.string().min(1).max(120).describe("What it is, shown to the user."),
        why: z.string().max(300).describe("Why it is needed."),
      }),
    },
  );
