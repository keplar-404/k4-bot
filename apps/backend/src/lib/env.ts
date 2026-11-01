import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars"),
  BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),
  WEB_ORIGIN: z.url("WEB_ORIGIN must be a valid URL").optional(),
  /** Parent domain shared by web and API (e.g. "example.com") so the session cookie reaches both. */
  COOKIE_DOMAIN: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  // Agent guardrails (cost + abuse containment)
  MAX_DAILY_TOKENS_PER_USER: z.coerce.number().int().positive().default(2_000_000),
  MAX_RUNS_PER_USER: z.coerce.number().int().positive().default(50),
  RUN_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(900),
  WS_TOKEN_SECRET: z.string().min(32).optional(),
  // z.coerce.boolean() would turn the string "false" into true.
  LANGSMITH_TRACING: z.stringbool().default(false),
});

export type Env = z.infer<typeof envSchema> & {
  CHAT_RELAY: DurableObjectNamespace;
  CHAT_RUN: Workflow;
  /** Per-IP limiter for every API request. */
  RL: RateLimit;
  /** Per-user limiter for mutating/expensive routes. */
  RL_WRITE: RateLimit;
};

// Bindings object is stable for the life of a request; parse it once.
const parsedEnv = new WeakMap<object, Env>();

export function parseEnv(env: unknown): Env {
  const key = env as object;
  const cached = parsedEnv.get(key);
  if (cached) return cached;
  const parsed = { ...(env as Record<string, unknown>), ...envSchema.parse(env) } as Env;
  parsedEnv.set(key, parsed);
  return parsed;
}

// Convenience singleton for non-Worker (standalone) entrypoints.
// Workers must use parseEnv(c.env) with their bindings instead.
export const env: Env =
  typeof process !== "undefined" && process.env?.DATABASE_URL
    ? parseEnv(process.env)
    : ({} as Env);
