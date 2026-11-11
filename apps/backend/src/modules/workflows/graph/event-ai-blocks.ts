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

/** One field of a structured answer: the model must return exactly these, typed (output.json.<name>). */
export const answerField = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,39}$/),
  type: z.enum(["text", "number", "boolean", "list", "enum"]).default("text"),
  description: text(300).default(""),
  /** "enum" only: the answer is one of these. */
  choices: z.array(text(80)).max(20).default([]),
});
export type AnswerField = z.infer<typeof answerField>;

/**
 * A step done by a model (summarise, classify, write a reply…). `agent` "normal": just the chosen model, no persona,
 * memory, apps or files. "bot": one of the user's bots, with its memory, persona, optional read-only apps (`useApps`)
 * and knowledge `files`. `prompt` may hold {{references}}. The answer is text, free JSON, or "structured": exactly the
 * `schema` fields (the model is forced into that shape).
 */
export const aiConfig = z.object({
  /** Saved before "normal" existed: those blocks are bot blocks. New blocks start as "normal" (web new-block.ts). */
  agent: z.enum(["normal", "bot"]).default("bot"),
  botId: text(64).optional(),
  modelId: text(120).optional(),
  reasoningEffort: text(20).optional(),
  prompt: template(8000).default(""),
  output: z.enum(["text", "json", "structured"]).default("text"),
  schema: z
    .array(answerField)
    .max(20)
    .default([])
    .refine((rows) => new Set(rows.map((r) => r.name)).size === rows.length, "Each answer field needs its own name."),
  useApps: z.boolean().default(false),
  files: z.array(z.string().regex(/^[0-9a-f-]{36}$/)).max(10).default([]),
});
