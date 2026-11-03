---
name: e2b-computer
description: How this project gives each user one E2B desktop computer shared by their bots (per-bot Linux users, GUI lease, private live view through the Worker, usage meter). Use when changing apps/backend/src/computer, the computer routes, the agent's computer tools, or the web computer panel.
---

# E2B computer (this project)

One E2B **Desktop** sandbox per user, owned by the `UserComputerDurableObject`
(`apps/backend/src/modules/computer/user-computer.ts`, named by user id). Every bot of that user
shares it. Docs: https://e2b.dev/docs and the `e2b-docs` MCP server in `.mcp.json`.
Package: `@e2b/desktop` (wraps `e2b`).

## Rules that were verified, not guessed

- **Lifecycle**: create with `lifecycle: { onTimeout: "pause" }`; `Sandbox.connect(id)` resumes a
  paused sandbox with memory intact; `Sandbox.pause(id)` works with only the id (after a DO eviction).
  Paused sandboxes are not billed. Default desktop template is 8 vCPU / 8 GiB, about $0.53/h.
- **Private**: `network: { allowPublicTraffic: false }`. Reaching a port needs the header
  `e2b-traffic-access-token: sandbox.trafficAccessToken`. Only the Worker proxy sends it.
- **Egress**: `denyOut` blocks private ranges and cloud metadata (`DENY_OUT` in `guards.ts`);
  public internet still works. E2B's own MMDS (169.254.169.254) answers "No MMDS": it holds only sandbox ids.
- **Isolation between bots** is OS level: each bot is a Linux user `u_<24 hex of bot id>`. Its home is 755 and it
  works with umask 022, so every bot can READ every other bot's files but only the owner can change, move or
  delete them (the kernel enforces it; verified: rm/mv/append on another bot's file are denied). The browser
  profile (`~/.chrome`) stays 700. `/home/BOTS.md` (root-owned) maps bot names to folders. Bot file I/O runs as the
  bot's own user, never through E2B's files API (that acts as root). Deep Agents' `permissions` do NOT apply to
  sandbox backends.
- **No admin access** (verified as a bot): no sudo (password required, bots have none), `su` fails (root
  password locked by the hardening step), no writes to /etc, /usr, /opt, no access to /home/user or /etc/shadow,
  other users' processes hidden (`hidepid=2`), `ulimit -u 2048` per bot (cannot be raised). Not covered: a bot
  can still fill the disk or use a lot of memory, and any process with DISPLAY can drive the shared X screen.
- **One mouse**: a single lease (bot id or user). Bots wait up to 20s for it; the user's "Take control"
  takes it (heartbeat every 15s, 5 min expiry).
- **Live view**: noVNC through `modules/computer/routes` (`/computer/stream/:mode/:userId/:token/*`).
  `watch` = our own `x11vnc -viewonly` on 5911/6091 (read-only is enforced on the VM, not in the browser);
  `control` = 5912/6092, only while the user holds the lease. The default port 6080 is NOT usable
  until `stream.start()` runs, so do not depend on it. The token is in the path so noVNC's relative
  assets and WebSocket inherit it. The proxy returns `new Response(null, upstream)` for sockets
  (keeps the `binary` subprotocol; dropping it gives "Missing client protocol").
- **x11vnc needs `-noxdamage`** (plus `-wait 50`): with X damage events the preview froze while a bot scrolled or
  typed in Chrome (Chrome's compositor does not send them). Servers started without the flag are replaced.
  When killing a server, use `pkill -f "[-]rfbport 5911"`: a plain pattern matches the shell running pkill
  and kills it ("signal: terminated").
- **One computer per user**: if the Durable Object has no sandbox id (or it is gone), it first looks for the
  user's sandbox by metadata (`app=k4-bot, userId`) and adopts it, killing any extra, before creating one.
- **xdotool**: use `mousemove --sync` style helpers sparingly; `--sync` can stall 15s. Chrome is launched per bot
  with `--class=k4_<user> --user-data-dir=<home>/.chrome`; a cold start takes several seconds, so
  `open_url` waits for the window (`xdotool search --onlyvisible --class`).
- **Screenshots** go to the model as a transient user message (`modules/computer/screen-middleware.ts`), never into the
  checkpoint or the database. Coordinates are whole pixels on a 1280x800 screen; models often send fractions,
  so the validation error says so.

## Shutting down while bots work

- **Who is working**: a bot is "using the computer" from its first shell, file or screen action until its run
  slice ends (`releaseBot`), or 3 min after its last action (crash safety). Kept in the DO's `workers` table and
  sent in `status.working`.
- **The user's Sleep** (`POST /computer/pause`) is refused with 409 `BOTS_WORKING` + the list unless `force`; the
  page then asks: Keep running / Wrap up / Force shut down. The server decides, so a stale tab cannot kill work.
- **A bot's `turn_off_computer`** is not in `interruptOn`: the tool asks the user itself (`interrupt` kind
  `confirm`, Yes/No buttons in the chat) only when another bot is working or the user holds the mouse.
- **Forced shutdowns** (user, daily limit, session end with bots working) are stored as `closed`. Each affected bot
  is told on its next model call (screen middleware `notice`) and by every computer tool error, then writes a final
  message. Errors from calls cut off by the shutdown are mapped to that text (the `pausing` flag), not E2B's raw error.
- **Wrap up** tells every bot to finish and summarise. The computer sleeps as soon as no bot is working, or after
  `COMPUTER_WRAP_MINUTES` at most.
- **Daily limit**: the session clock shows whichever ends first, session or today's minutes (`session.reason`).
  The warning starts `COMPUTER_WRAP_MINUTES` before; at the limit it shuts down exactly (an alarm is set for it).
  Waking needs at least 60 s left; nobody can wake it again until 00:00 UTC.

Verified on a real VM: 409 while a bot works, wrap-up sleeping early once the bot finished, forced shutdown with
the bot's final message, Yes/No on `turn_off_computer`, warning plus exact shutdown at the daily limit, and wake refused afterwards.

## Files between the chat and the computer

- **Every file that crosses the chat boundary is a saved copy** in R2 (`FILES` binding) plus a `chat_file` row: user
  uploads (`POST /files`), images from `generate_image` (OpenRouter `POST /api/v1/images`, model `IMAGE_MODEL`) and files
  a bot gives the user with `share_file`. Downloads (`GET /files/:id/content`) come from R2, so they work while the
  computer sleeps and cost no computer time. Files outlive their bot and chat (links set null) and stay on the Files page.
- **Bot rights come from Linux, not the tools**: `copy_to_computer` writes through the DO's `upload` (runs as the bot's
  user), so writing into another bot's home is refused (verified); `share_file` reads through `download` as the bot, so
  other bots' files are shareable (verified) but private folders are not. Limit 25 MB per file (DO RPC messages cap at 32 MiB).
- **File cards reach the UI through the tool result text**: a `FILE_REF {json}` line (`fileMarker` in `modules/agent/parts.ts`),
  lifted into `ToolPart.files` by `modules/agent/run-stream/index.ts`. A ToolMessage artifact would be dropped by the event stream.
- **Images the model sees** (attachments, `view_image`) are added per model call by `modules/agent/view-middleware.ts`, never
  saved in the checkpoint (same reason as screenshots).
- **Serving**: only PNG/JPEG/GIF/WebP/AVIF are inline; everything else (HTML, SVG) is `application/octet-stream` +
  attachment + `CSP: sandbox`, so a stored file can never run as a page of the API origin (verified).
- **Cost guards**: `MAX_IMAGES_PER_DAY` counted from `agent_usage` rows with model `image:<id>` (deleting files does
  not give images back), `MAX_STORAGE_MB_PER_USER`, uploads rate limited by `RL_WRITE`.

## Cost and abuse guards (all in the DO / guards.ts)

Daily minutes cap (`COMPUTER_MAX_MINUTES_PER_DAY`), idle pause (`COMPUTER_IDLE_MINUTES`), per-run action cap,
90 actions/min, 4 parallel execs, URL guard (http/https, no private/metadata hosts, optional allowlist),
key-combo guard, secret/card detector for typed text, output caps. Only `POST /computer/wake` and a bot's
first tool call can start billing. Never leave a sandbox running after a test: pause or kill by id
(`e2b sandbox kill <id>`), never `--all`.

## Testing

`bun run check` in `apps/backend` runs the guard checks. The real VM flow is exercised with `wrangler dev`
plus a signed-in test user: wake, run a bot task, open the live view, take control, then pause.
