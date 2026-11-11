import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars"),
  // Trimmed: a stray space (e.g. `' http://...'` in .dev.vars) would end up in auth links and origin checks.
  BETTER_AUTH_URL: z.string().trim().pipe(z.url("BETTER_AUTH_URL must be a valid URL")),
  WEB_ORIGIN: z.string().trim().pipe(z.url("WEB_ORIGIN must be a valid URL")).optional(),
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
  /** The user (and bots) are warned this long before the session or today's computer time ends; "Wrap up" gives bots at most this long to finish. */
  COMPUTER_WRAP_MINUTES: z.coerce.number().int().positive().default(5),
  /** Mouse/keyboard actions one agent run may take. */
  COMPUTER_MAX_ACTIONS_PER_RUN: z.coerce.number().int().positive().default(400),
  /** Optional comma-separated allow-list of hostnames the computer may reach. Empty = any public host. */
  COMPUTER_ALLOWED_HOSTS: z.string().optional(),
  // --- Files (uploads, generated images, files shared from the computer; kept in R2) ---
  /** OpenRouter image model for generate_image (POST /api/v1/images). */
  IMAGE_MODEL: z.string().default("google/gemini-3.1-flash-image"),
  /** With the free router, calls that carry pictures go to this free vision model (the router may pick one that cannot see). */
  FREE_VISION_MODEL: z.string().default("google/gemma-4-31b-it:free"),
  /** Images a user's bots may create per UTC day: every image is billed by OpenRouter. */
  MAX_IMAGES_PER_DAY: z.coerce.number().int().positive().default(20),
  /** Paid OCR (Mistral, $2 per 1,000 pages) for scanned PDF pages the free readers cannot read; "off" disables it. */
  PDF_OCR: z.enum(["mistral-ocr", "off"]).default("mistral-ocr"),
  /** Pages one user may OCR per day (UTC). */
  MAX_OCR_PAGES_PER_DAY: z.coerce.number().int().nonnegative().default(50),
  /** Total size of one user's stored files. */
  MAX_STORAGE_MB_PER_USER: z.coerce.number().int().positive().default(1024),
  // --- Sandboxes (one E2B code sandbox per bot) ---
  SANDBOX_MAX_PER_USER: z.coerce.number().int().positive().default(3),
  SANDBOX_IDLE_MINUTES: z.coerce.number().int().positive().default(10),
  SANDBOX_TEMPLATE: z.string().default("base"),
  SANDBOX_MAX_MINUTES_PER_DAY: z.coerce.number().int().positive().default(240),
  // --- Composio (per-user connected apps: Gmail, Slack, GitHub, ...) ---
  COMPOSIO_API_KEY: z.string().optional(),
  /** "true" runs app actions through Composio sessions instead of direct execution (off until verified per deployment). */
  COMPOSIO_SESSIONS: z.enum(["true", "false"]).default("false"),
  // --- TypeSafe (Jev decision model) for the workflow Decide block: https://docs.typesafe.ai ---
  TYPESAFE_API_KEY: z.string().optional(),
  // --- Secrets users give us (MCP tokens, workflow secrets): AES-256-GCM, see shared/secrets.ts ---
  /** 32 random bytes, base64. Generate with: openssl rand -base64 32 */
  SECRETS_ENCRYPTION_KEY: z.string().optional(),
  /** Verifies app events Composio delivers (the project's webhook subscription secret). Without it they are refused. */
  COMPOSIO_WEBHOOK_SECRET: z.string().min(16).optional(),
  /** The previous key while rotating, so values encrypted with it still decrypt. */
  SECRETS_ENCRYPTION_KEY_PREVIOUS: z.string().optional(),
  /** Agent steps per Workflow step. A run longer than this continues in the next slice. */
  RUN_SLICE_STEPS: z.coerce.number().int().positive().default(60),
  /** Upper bound on slices per run (steps x slices = the hard ceiling on one run). */
  MAX_RUN_SLICES: z.coerce.number().int().positive().default(300),
  // z.coerce.boolean() would turn the string "false" into true.
  LANGSMITH_TRACING: z.stringbool().default(false),
});

export type Env = z.infer<typeof envSchema> & {
  CHAT_RELAY: DurableObjectNamespace<import("../modules/chat/relay").ChatRelayDurableObject>;
  CHAT_RUN: Workflow;
  /** Background sub-agent tasks (start_background_task): one Workflow each, and one registry per chat thread. */
  ASYNC_TASK: Workflow;
  /** Workflow runs, and the live socket each workflow's open builders listen on. */
  WORKFLOW_RUN: Workflow;
  /** The workflow builder assistant: one Workflow instance per turn. */
  ASSISTANT_RUN: Workflow;
  WORKFLOW_LIVE: DurableObjectNamespace<import("../modules/workflows/live/relay").WorkflowRunRelay>;
  ASYNC_TASKS: DurableObjectNamespace<import("../modules/async-tasks/registry").AsyncTaskRegistry>;
  /** Per-IP limiter for every API request. */
  RL: RateLimit;
  /** Per-user limiter for mutating/expensive routes. */
  RL_WRITE: RateLimit;
  /** Workflow draft saves (autosave), per user. */
  RL_WF_SAVE: RateLimit;
  /** Workflow runs started by a user (manual, test, webhook), per user or workflow. */
  RL_WF_RUN: RateLimit;
  /** Public webhook calls, per workflow. */
  RL_WF_HOOK: RateLimit;
  /** Composio actions run by bots and workflow blocks, per user. */
  RL_APP_EXEC: RateLimit;
  /** Workflow HTTP request blocks, per user. */
  RL_HTTP: RateLimit;
  /** Messages to the workflow assistant, per user. */
  RL_ASSISTANT_MSG: RateLimit;
  /** One computer per user: addressed by user id. */
  USER_COMPUTER: DurableObjectNamespace<import("../modules/computer/user-computer").UserComputerDurableObject>;
  /** One sandbox per bot: addressed by bot id. */
  BOT_SANDBOX: DurableObjectNamespace<import("../modules/sandbox").BotSandbox>;
  /** Stored files. Without the binding, uploads and the file tools are off. */
  FILES?: R2Bucket;
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
