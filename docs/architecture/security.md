# Security

The threat model: users are untrusted, the browser is untrusted, and **everything a model reads is untrusted** (web
pages, emails, app data, files, tool results). Bots act on real accounts and spend real money, so every capability is
bounded by authorization, by the permission mode, and by caps, enforced on the server.

## Principles

1. **Never trust the frontend.** Every input is validated with zod on the server; every rule the UI shows is checked again.
2. **Scope every query to the session user.** Someone else's id answers `404`, exactly like a missing one (no probing).
3. **Least privilege for bots.** Access is per bot (which apps, skills, MCP servers, workflows), read and write are
   separate, and the permission mode decides what needs the user's approval.
4. **Secrets never reach a model or the browser.** They are encrypted at rest, decrypted only on the server right
   before use, and scrubbed from anything stored or shown.
5. **Cost has a ceiling that deleting rows cannot reset.**
6. **Untrusted text is data, never instructions.**

## Authentication

| Mechanism | Detail |
|---|---|
| Better Auth | Email + password (verification by email through Resend) and optional Google OAuth. Base path `/api/v1/auth` |
| Sessions | Database sessions, 7 days, refreshed daily; signed cookie cache for 5 minutes. `COOKIE_DOMAIN` shares the cookie between web and API subdomains |
| Brute force | Better Auth's database limiter: sign-in 5/min, sign-up 3/min, password reset 3/min, everything else 100/min |
| Trusted origins | `BETTER_AUTH_URL` and `WEB_ORIGIN` only |
| Route guard | `middleware/auth-guard.ts` on every private router; public routes authenticate otherwise (below) |

### Routes without a session, and what protects them

| Route | Protection |
|---|---|
| `POST /api/v1/hooks/:id/:token` (workflow webhook) | 256-bit random token; only its SHA-256 is stored; constant-time compare; every failure is the same `404`; JSON only, 256 KB, 60/min per workflow; a run cannot call its own webhook (loop header) |
| `POST /api/v1/composio/events` | HMAC-SHA256 over `id.timestamp.body` with `COMPOSIO_WEBHOOK_SECRET`, constant-time compare, 5-minute timestamp window (replays refused), event id dedupe for 7 days; refused with `503` when no secret is configured |
| WebSockets (chat, workflow live, computer) | Short-lived HMAC tokens bound to user and channel (`shared/relay-token.ts`); `Origin` checked against `WEB_ORIGIN` |
| `GET /computer/stream/:mode/:userId/:token/*` | Token in the path (iframes cannot send headers), 30-minute lifetime, framing allowed only by `WEB_ORIGIN`, no referrer, user cookies never forwarded to the VM |

## Authorization and permission modes

Each chat thread has a mode, picked in the prompt bar:

| Mode | Behaviour | Enforced by |
|---|---|---|
| **Ask** (default) | Actions that change something pause for an Approve / Reject card | LangChain human-in-the-loop interrupts (`agent/approvals.ts`, `account-tools.ts`) |
| **Plan** | Read-only. Only an **allow-list** of tools is offered; anything else is refused in code. The bot can ask to switch mode | `agent/modes.ts` (`PLAN_ALLOWED`), `middleware/plan-guard.ts` |
| **Allow all** | Acts without asking, except tools that always ask (turning on the computer, deleting a sandbox) | `approvalsFor()` |

The allow-list is deliberate: a new or third-party tool is blocked in Plan mode until someone adds it on purpose.

Bots and connected apps: a bot can use only the apps the user enabled for it; `app_read` refuses any action that is not
known to be read-only (unknown counts as a write); `app_act` needs the per-app "allow writes" flag, then the mode.

## Secrets

| What | How |
|---|---|
| Algorithm | AES-256-GCM (Web Crypto), random 96-bit IV per value, 128-bit tag (`shared/secrets.ts`) |
| Key | `SECRETS_ENCRYPTION_KEY` (32 random bytes, base64), a Worker secret, never in the database |
| Binding | Associated data ties each ciphertext to its user and row: a value copied to another row does not decrypt |
| Rotation | Stored form `v1.<keyId>.<iv>.<ct>`; put the old key in `SECRETS_ENCRYPTION_KEY_PREVIOUS` |
| Display | Only the last 4 characters |
| Collection from bots | `request_secret` shows a secure form; the value goes from the browser to `PUT /secrets/:name`; the model is told only "saved". The server checks the row exists before telling the bot (a forged "saved" does not work) |
| Use in workflows | `{{secrets.NAME}}` is allowed only in app and HTTP blocks (refused at publish anywhere else, including AI prompts) |
| Redaction | Every secret value is replaced by `[secret:NAME]` in a run's stored input, output and error |
| Deletion | Refused while a workflow uses the secret (the error names the workflows) |

MCP server tokens use the same encryption.

## Prompt injection and untrusted content

- System prompts state that tool results, web pages, files and app data are data, never instructions.
- In workflow AI steps, every value filled into the prompt is wrapped in `<data>…</data>`, and a value cannot close the
  wrapper early. The AI step has **no tool that changes anything** (web search, read-only app tools, its knowledge
  files), so the worst outcome of a successful injection is bad text; whether that text is sent is decided by the next
  block, which the user placed.
- Template values are never re-evaluated: data containing `{{steps.…}}` stays literal text (the n8n CVE-2026-27493 class).
- Template paths cannot walk into prototypes (`__proto__`, `constructor`, `prototype` are refused).

## Server-side request forgery (SSRF)

The workflow HTTP block and the computer's URL guard allow only public `http(s)` hosts: no private or link-local
ranges, no cloud metadata address, no IPv6 literals, no internal names, no credentials in URLs, never this app's own
hosts, and https outside local dev. Requests have a timeout and a response size cap. Cloudflare Workers cannot reach
private networks, which also defeats DNS rebinding. The computer additionally has an optional hostname allow-list
(`COMPUTER_ALLOWED_HOSTS`) and E2B's firewall.

## Computers and code sandboxes

- One desktop per user; each bot is its own Linux user with its own home, browser profile and files; other bots' homes
  are not readable. The user's mouse and keyboard control is an explicit, time-limited lease.
- Deterministic guards (`computer/guards/`) check URLs, key names, typed text and shell quoting before anything reaches
  the VM. Actions per run are capped (`COMPUTER_MAX_ACTIONS_PER_RUN`).
- Daily running-time meters (computer and sandboxes), idle auto-pause and session limits bound the E2B bill.
- Code sandboxes: paths stay inside the workspace, commands time out (1–600 s), edits must match exactly one place.

## Files, skills and MCP servers

- Files: per-user storage quota (`MAX_STORAGE_MB_PER_USER`), 25 MB per file, MIME type derived from the name, keys
  namespaced by user, served with `nosniff`.
- Skills come from skills.sh only (catalog ids), with size (3 MB) and file-count (300) caps and safe relative paths.
- MCP servers come from a curated catalog; user tokens are encrypted; servers marked as needing approval go through the
  mode rules.

## Rate limits and caps

| Limiter | Limit | Scope |
|---|---|---|
| `RL` | 100/min | every API request, per IP |
| `RL_WRITE` | 20/min | mutating or costly routes, per user |
| `RL_WF_SAVE` | 60/min | workflow autosave, per user |
| `RL_WF_RUN` | 10/min | workflow runs started by a user |
| `RL_WF_HOOK` | 60/min | webhook and app-event runs, per workflow |
| `RL_APP_EXEC` | 30/min | Composio actions (bots and workflows), per user |
| `RL_HTTP` | 30/min | workflow HTTP requests, per user |

Plus daily caps (tokens, chat runs, workflow runs, AI steps, images, OCR pages, computer and sandbox minutes) listed
in [Limits](../reference/limits.md). Loops are bounded too: workflows refuse cycles, For each is capped at 100 items and
300 block runs, bot ↔ workflow chains are at most two deep, and an app-event workflow that keeps triggering itself is
turned off automatically.

## HTTP hardening

CORS only for `WEB_ORIGIN` with credentials; `secureHeaders` (HSTS, nosniff, frame options, …) on every response except
the computer stream, which sets `frame-ancestors <WEB_ORIGIN>` itself; a 1 MB body limit; cookies `HttpOnly`, `Secure`
in production.

## Security checklist for new code

- [ ] Private route uses `authGuard`; public route has a signed token or constant-time secret check.
- [ ] Every input parsed with zod; every query filtered by the session user; someone else's id → `404`.
- [ ] Expensive actions use a per-user limiter and count toward a daily cap that deleting rows cannot reset.
- [ ] New agent tools validate arguments, re-check ownership, respect the mode (add to `PLAN_ALLOWED` only if read-only),
      clip their output, and never return secrets.
- [ ] No `eval`, `new Function`, or regular expressions built from user input.
- [ ] Cross-user test: user B gets `404` on user A's ids.
