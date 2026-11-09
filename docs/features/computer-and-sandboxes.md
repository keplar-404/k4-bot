# Computer and code sandboxes

Both run on [E2B](https://e2b.dev) and need `E2B_API_KEY`. `COMPUTER_ENABLED=false` switches the computer off without
a deploy.

## The computer (one desktop per user)

Each user has one Linux desktop VM (E2B template `E2B_TEMPLATE`, default `desktop`), shared by all of their bots.

- **Per-bot isolation:** each bot is its own Linux user with its own home folder, browser profile and files. Bots
  cannot read each other's homes.
- **Provisioning:** created when the user verifies their email (scheduled, never blocking the request).
- **Owner:** the `UserComputerDurableObject` (`modules/computer/user-computer.ts` and `durable/`), addressed by user id.
  It holds the power state (`off`, `starting`, `running`, `paused`, `error`), the session clock, the daily meter, the
  control lease and the activity feed.

### Lifecycle

| Event | What happens |
|---|---|
| Wake (`POST /computer/wake` or the bot's `turn_on_computer`) | Resumes the paused VM (or makes a new one), hardens it, removes accounts of deleted bots, starts the screen servers |
| Idle `COMPUTER_IDLE_MINUTES` (5) | Paused with a screenshot saved (paused VMs are not billed) |
| Session `COMPUTER_SESSION_MINUTES` (20) | Ends; bots and the user are warned `COMPUTER_WRAP_MINUTES` (5) before, and "Wrap up" lets bots finish |
| Daily `COMPUTER_MAX_MINUTES_PER_DAY` (120) | No more waking until 00:00 UTC |
| Reset | Replaces it with a brand-new computer |
| E2B paused it on its own | The next screen request notices, marks it asleep and shows the wake button |

### Live view

The panel shows the screen with noVNC in an iframe, through the API (`/computer/stream/:mode/:userId/:token/*`):

- `watch` is a view-only VNC server; `control` exists only while the user holds the mouse and keyboard (a lease taken
  with `POST /computer/control/take`, kept alive, released or expired).
- The proxy hides noVNC's own toolbar and status, and the page reports its connection state to the panel, which shows
  one "Connecting to the screen…" state until it is live.
- The viewer link is minted once per session and lives 30 minutes; the user's cookies are never sent to the VM.

### Guards

Pure, tested functions (`computer/guards/`) check everything a prompt injection could abuse before it reaches the VM:
URLs (public http(s) only, no metadata service or private ranges, optional `COMPUTER_ALLOWED_HOSTS`), key names,
typed text, and shell quoting. Actions per agent run are capped (`COMPUTER_MAX_ACTIONS_PER_RUN`, 400).

## Code sandboxes (one per bot)

The coding role uses its own E2B sandbox (template `SANDBOX_TEMPLATE`, default `base`), owned by the `BotSandbox`
Durable Object and recorded in `bot_sandbox`.

| Rule | Value |
|---|---|
| Sandboxes per user | `SANDBOX_MAX_PER_USER` (3) |
| Idle pause | `SANDBOX_IDLE_MINUTES` (10), only when no bot is working and no editor is open |
| Daily time per user | `SANDBOX_MAX_MINUTES_PER_DAY` (240) |
| Command timeout | 1–600 s, 120 by default |
| Edits | Must match exactly one place in the file |
| Delete | Always asks the user |

The web app has a code editor for the sandbox (`features/code-editor`, routes in `sandbox/editor-routes.ts`) and a
preview URL for web servers the bot starts.

## Key files

| Path | Purpose |
|---|---|
| `apps/backend/src/modules/computer/durable/` | lifecycle, power, sleep, session, meter, accounts, control, panel, vnc |
| `apps/backend/src/modules/computer/routes/` | control (wake, pause, reset, settings, lease), viewer, stream proxy |
| `apps/backend/src/modules/computer/tools/` | `turn_on_computer`, `computer`, `turn_off_computer` |
| `apps/backend/src/modules/sandbox/` | sandbox lifecycle, policy, exec, editor |
| `apps/web/src/features/computer/` | panel, screen, status socket, control |
| `apps/web/src/features/sandboxes/`, `features/code-editor/` | sandbox list and editor |
