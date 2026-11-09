# Configuration

Every backend setting is declared and validated in `apps/backend/src/config/env.ts`; a wrong value stops the Worker
with a message naming the variable. Locally they go in `apps/backend/.dev.vars`; in production use
`wrangler secret put` for secrets and `vars` (or the dashboard) for the rest.

## Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (pooled) used at runtime |
| `BETTER_AUTH_SECRET` | ≥ 32 characters; signs sessions |
| `BETTER_AUTH_URL` | The API's public URL (`http://localhost:8787` locally) |

## Strongly recommended

| Variable | Default | Description |
|---|---|---|
| `WEB_ORIGIN` | — | The web app's origin: CORS, trusted origin, framing of the computer screen, Composio return links |
| `OPENROUTER_API_KEY` | — | All models (chat, AI steps, images, scanned PDFs). Without it bots cannot answer |
| `DATABASE_URL_UNPOOLED` | — | Direct connection for `drizzle-kit` migrations |

## Feature keys (each turns a feature on)

| Variable | Feature |
|---|---|
| `TAVILY_API_KEY` | Web search, crawling, `/deep-research` |
| `COMPOSIO_API_KEY` | Connected apps, app blocks, bot app tools, app events |
| `COMPOSIO_WEBHOOK_SECRET` | Accepting app events (≥ 16 characters; from `bun run composio:webhook`) |
| `TYPESAFE_API_KEY` | The workflow Decide block (TypeSafe Jev) |
| `E2B_API_KEY` | The computer and code sandboxes |
| `SECRETS_ENCRYPTION_KEY` | Secrets vault and MCP tokens (32 random bytes, base64) |
| `SECRETS_ENCRYPTION_KEY_PREVIOUS` | The old key while rotating |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `RESEND_API_KEY`, `MAIL_FROM` | Emails (otherwise logged to the console) |
| `WS_TOKEN_SECRET` | Separate key for socket tokens (≥ 32 chars; falls back to `BETTER_AUTH_SECRET`) |
| `COOKIE_DOMAIN` | Parent domain when web and API are sibling subdomains |
| `LANGSMITH_TRACING` | `true` to trace agent runs in LangSmith |

## Limits and tuning

| Variable | Default | Meaning |
|---|---|---|
| `MAX_DAILY_TOKENS_PER_USER` | 2000000 | Paid-model tokens per user per UTC day |
| `MAX_RUNS_PER_USER` | 50 | Chat messages per user per UTC day |
| `MAX_OUTPUT_TOKENS` | 8192 | Per model reply |
| `RUN_SLICE_STEPS` | 60 | Agent steps per durable slice |
| `MAX_RUN_SLICES` | 300 | Slices per chat run |
| `IMAGE_MODEL` | `google/gemini-3.1-flash-image` | Image generation model |
| `FREE_VISION_MODEL` | `google/gemma-4-31b-it:free` | Vision model used with the free router |
| `MAX_IMAGES_PER_DAY` | 20 | Generated images per user |
| `PDF_OCR` | `mistral-ocr` | `off` disables paid OCR |
| `MAX_OCR_PAGES_PER_DAY` | 50 | OCR pages per user |
| `MAX_STORAGE_MB_PER_USER` | 1024 | Stored files per user |
| `COMPUTER_ENABLED` | true | Kill switch for the computer |
| `E2B_TEMPLATE` | `desktop` | Computer template |
| `COMPUTER_MAX_MINUTES_PER_DAY` | 120 | Computer time per user |
| `COMPUTER_IDLE_MINUTES` | 5 | Idle pause |
| `COMPUTER_SESSION_MINUTES` | 20 | One wake-up |
| `COMPUTER_WRAP_MINUTES` | 5 | Warning / wrap-up window |
| `COMPUTER_MAX_ACTIONS_PER_RUN` | 400 | Screen actions per agent run |
| `COMPUTER_ALLOWED_HOSTS` | — | Comma-separated allow-list of hosts the computer may reach |
| `SANDBOX_MAX_PER_USER` | 3 | Code sandboxes per user |
| `SANDBOX_IDLE_MINUTES` | 10 | Sandbox idle pause |
| `SANDBOX_TEMPLATE` | `base` | Sandbox template |
| `SANDBOX_MAX_MINUTES_PER_DAY` | 240 | Sandbox time per user |

## Bindings (`wrangler.jsonc`)

| Binding | Kind |
|---|---|
| `CHAT_RELAY`, `USER_COMPUTER`, `BOT_SANDBOX`, `ASYNC_TASKS`, `WORKFLOW_LIVE` | Durable Objects |
| `CHAT_RUN`, `ASYNC_TASK`, `WORKFLOW_RUN` | Workflows |
| `FILES` | R2 bucket `k4-bot-files` |
| `RL`, `RL_WRITE`, `RL_WF_SAVE`, `RL_WF_RUN`, `RL_WF_HOOK`, `RL_APP_EXEC`, `RL_HTTP` | Rate limiters |
| crons `* * * * *`, `0 3 * * *` | Scheduled handler |

## Web app

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_AUTH_URL` | `http://localhost:8787` | The API's public URL (built into the client bundle) |
