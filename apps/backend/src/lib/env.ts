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
  /** Per model reply. OpenRouter reserves credit for the full amount, so keep it modest. */
  MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(8192),
  MAX_RUNS_PER_USER: z.coerce.number().int().positive().default(50),
  WS_TOKEN_SECRET: z.string().min(32).optional(),

  // --- Computer (one E2B desktop per user, shared by that user's bots) ---
  E2B_API_KEY: z.string().optional(),
  /** Kill switch: false disables every computer feature without a deploy. */
  COMPUTER_ENABLED: z.stringbool().default(true),
  /** E2B template. The official "desktop" template is 8 vCPU / 8 GiB; a smaller custom one costs less. */
  E2B_TEMPLATE: z.string().default("desktop"),
  /** Running time per user per UTC day. The meter is the main protection for the E2B bill. */
  COMPUTER_MAX_MINUTES_PER_DAY: z.coerce.number().int().positive().default(120),
  /** No activity for this long and the computer is paused (paused computers are not billed). */
  COMPUTER_IDLE_MINUTES: z.coerce.number().int().positive().default(5),
  /** One wake-up lasts at most this long; then the computer is paused with its state saved. */
  COMPUTER_SESSION_MINUTES: z.coerce.number().int().positive().default(20),
  /** The user is asked to wrap up this long before the session ends; "Wrap up" gives the bot this long to finish. */
  COMPUTER_WRAP_MINUTES: z.coerce.number().int().positive().default(2),
  /** Mouse/keyboard actions one agent run may take. */
  COMPUTER_MAX_ACTIONS_PER_RUN: z.coerce.number().int().positive().default(400),
  /** Optional comma-separated allow-list of hostnames the computer may reach. Empty = any public host. */
  COMPUTER_ALLOWED_HOSTS: z.string().optional(),
  /** Agent steps per Workflow step. A run longer than this continues in the next slice. */
  RUN_SLICE_STEPS: z.coerce.number().int().positive().default(60),
  /** Upper bound on slices per run (steps x slices = the hard ceiling on one run). */
  MAX_RUN_SLICES: z.coerce.number().int().positive().default(300),
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
  /** One computer per user: addressed by user id. */
  USER_COMPUTER: DurableObjectNamespace<import("../computer/user-computer").UserComputerDurableObject>;
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
