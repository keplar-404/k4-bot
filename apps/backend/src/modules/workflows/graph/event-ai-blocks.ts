import { z } from "zod";

const text = (max: number) => z.string().max(max);
/** A value that may hold `{{ references }}`, filled in when the run reaches the block. */
const template = (max: number) => z.string().max(max);

/**
 * An event in a connected app starts the workflow (a Slack message, a new Gmail message, a GitHub push…): any trigger
 * type Composio offers. `config` follows that trigger type's own schema; the account is the user's own.
 */
export const appTriggerConfig = z.object({
  toolkit: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)
    .optional(),
  trigger: z
    .string()
    .regex(/^[A-Z0-9_]{1,120}$/)
    .optional(),
  config: z.record(z.string().max(100), z.unknown()).default({}),
  connectedAccountId: text(100).optional(),
});

/**
 * A step done by one of the user's bots (summarise, classify, write a reply…). `prompt` may hold {{references}}; the
 * bot answers with text, or with one JSON object when `output` is "json". `useApps` lets it read (never change) its
 * connected apps. `files` are knowledge files from the user's Files page it may read (price lists, policies, FAQs).
 */
export const aiConfig = z.object({
  botId: text(64).optional(),
  prompt: template(8000).default(""),
  output: z.enum(["text", "json"]).default("text"),
  useApps: z.boolean().default(false),
  files: z.array(z.string().regex(/^[0-9a-f-]{36}$/)).max(10).default([]),
});
