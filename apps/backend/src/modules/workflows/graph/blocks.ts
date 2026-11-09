import { z } from "zod";

/** Size limits are part of the schema: nothing larger can be stored, run, or used to load the engine. */
export const LIMITS = {
  nodes: 50,
  edges: 100,
  conditions: 10,
  setFields: 20,
  argBytes: 20_000,
  minScheduleMinutes: 5,
  maxDelaySeconds: 7 * 24 * 3600,
  maxAttempts: 5,
  maxRetryDelaySeconds: 3600,
} as const;

const text = (max: number) => z.string().max(max);
/** A value that may hold `{{ steps.<node>.output.x }}` references, resolved when the run reaches the block. */
const template = (max: number) => z.string().max(max);

const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "exists",
  "not_exists",
  "is_true",
  "is_false",
] as const;

export const conditionSchema = z.object({
  left: template(4000),
  op: z.enum(OPERATORS),
  right: template(4000).optional(),
});

/** If and Filter blocks: their conditions, and whether all or any must hold. */
export const conditionsConfig = z.object({
  combine: z.enum(["all", "any"]).default("all"),
  conditions: z.array(conditionSchema).max(LIMITS.conditions),
});

/** Per-block retry (n8n's "Retry on fail"): only blocks that call the outside world use it. */
export const retrySchema = z.object({
  maxAttempts: z.number().int().min(1).max(LIMITS.maxAttempts).default(1),
  delaySeconds: z.number().int().min(1).max(LIMITS.maxRetryDelaySeconds).default(10),
  backoff: z.enum(["constant", "exponential"]).default("exponential"),
});

export { scheduleConfig } from "../../schedules/config";

export const appConfig = z.object({
  toolkit: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)
    .optional(),
  tool: z
    .string()
    .regex(/^[A-Z0-9_]{1,120}$/)
    .optional(),
  /** The tool version pinned when it was picked (Composio requires one for direct execution). */
  version: text(40).optional(),
  arguments: z.record(z.string().max(100), z.unknown()).default({}),
  connectedAccountId: text(100).optional(),
});

const httpHeader = z.object({ name: z.string().regex(/^[A-Za-z0-9-]{1,64}$/), value: template(2000) });
const httpBody = z.object({ type: z.enum(["none", "json", "text", "form"]), value: template(20_000) });

export const httpConfig = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: template(2048),
  headers: z.array(httpHeader).max(10).default([]),
  body: httpBody.default({ type: "none", value: "" }),
  timeoutSeconds: z.number().int().min(1).max(30).default(15),
  expect: z.enum(["json", "text"]).default("json"),
});

export const delayConfig = z.object({
  amount: z.number().int().min(1).max(10_000),
  unit: z.enum(["seconds", "minutes", "hours", "days"]),
});

const setField = z.object({ key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,40}$/), value: template(4000) });
export const setConfig = z.object({ fields: z.array(setField).max(LIMITS.setFields) });
