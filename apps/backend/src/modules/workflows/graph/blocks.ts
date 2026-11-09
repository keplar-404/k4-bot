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
  // Text
  "starts_with",
  "not_starts_with",
  "ends_with",
  "not_ends_with",
  // Text, lists and objects
  "is_empty",
  "is_not_empty",
  "length_equals",
  "length_gt",
  "length_lt",
  // Dates and times (ISO text, or milliseconds/seconds since 1970)
  "date_before",
  "date_after",
  "date_equals",
] as const;

export const conditionSchema = z.object({
  left: template(4000),
  op: z.enum(OPERATORS),
  right: template(4000).optional(),
  /** Text comparisons ignore case unless this is on. */
  caseSensitive: z.boolean().optional(),
});

/** A group of conditions with its own all/any: one level of nesting, e.g. "A and (B or C)". */
export const conditionGroup = z.object({
  combine: z.enum(["all", "any"]).default("any"),
  conditions: z.array(conditionSchema).max(LIMITS.conditions),
});

/**
 * If and Filter blocks: their conditions, and whether all or any must hold. Each group counts as one more condition
 * (true when its own conditions hold by its own all/any).
 */
export const conditionsConfig = z.object({
  combine: z.enum(["all", "any"]).default("all"),
  conditions: z.array(conditionSchema).max(LIMITS.conditions),
  groups: z.array(conditionGroup).max(5).default([]),
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

const httpQuery = z.object({ name: z.string().min(1).max(100), value: template(2000) });
/**
 * Sign-in presets: `token` is usually {{secrets.NAME}}. bearer → "Authorization: Bearer <token>", basic → user and
 * token as Basic auth, api_key → `headerName: <token>`.
 */
const httpAuth = z.object({
  type: z.enum(["none", "bearer", "basic", "api_key"]).default("none"),
  token: template(2000).default(""),
  username: template(200).default(""),
  headerName: z.string().regex(/^[A-Za-z0-9-]{1,64}$/).default("X-API-Key"),
});

/**
 * Pagination (n8n's pagination helper): `page` adds `param`=start, start+1…; `cursor` sends `param`=<value at
 * `nextPath` of the last page>; `next_url` follows the URL at `nextPath`. Items at `itemsPath` of every page are
 * collected into one list. Stops at `maxPages`, an empty page, or no next cursor / URL.
 */
const httpPagination = z.object({
  mode: z.enum(["none", "page", "cursor", "next_url"]).default("none"),
  param: z.string().regex(/^[A-Za-z0-9_.-]{0,60}$/).default("page"),
  start: z.number().int().min(0).max(1_000_000).default(1),
  itemsPath: z.string().max(200).default(""),
  nextPath: z.string().max(200).default(""),
  maxPages: z.number().int().min(1).max(10).default(5),
});

export const httpConfig = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: template(2048),
  /** Added to the URL's query string (encoded). */
  query: z.array(httpQuery).max(20).default([]),
  auth: httpAuth.prefault({}),
  pagination: httpPagination.prefault({}),
  headers: z.array(httpHeader).max(10).default([]),
  body: httpBody.default({ type: "none", value: "" }),
  timeoutSeconds: z.number().int().min(1).max(30).default(15),
  expect: z.enum(["json", "text"]).default("json"),
});

/**
 * Delay: `for` waits amount × unit; `until` waits until a date and time (text such as 2026-12-01T09:00:00+01:00, or a
 * {{reference}} to one; a time already past goes on at once); `next` waits until the next of `days` (0 = Sunday) at
 * `at` in `timezone`. Never more than 7 days.
 */
export const delayConfig = z.object({
  mode: z.enum(["for", "until", "next"]).default("for"),
  amount: z.number().int().min(1).max(10_000).default(1),
  unit: z.enum(["seconds", "minutes", "hours", "days"]).default("minutes"),
  until: template(200).default(""),
  days: z.array(z.number().int().min(0).max(6)).max(7).default([1]),
  at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
  timezone: z.string().max(64).default("UTC"),
});

const setField = z.object({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,40}$/),
  value: template(4000),
  /** What the value becomes: text as typed, or a number, yes/no, list or object read from it. */
  type: z.enum(["text", "number", "yes_no", "list", "object"]).default("text"),
});
/** Set fields: the output is these fields; with `base` (a {{reference}} to an object) they are added to a copy of it. */
export const setConfig = z.object({
  fields: z.array(setField).max(LIMITS.setFields),
  base: template(4000).default(""),
});
