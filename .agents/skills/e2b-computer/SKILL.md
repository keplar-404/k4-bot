---
name: e2b-computer
description: How this project gives each user one E2B desktop computer shared by their bots (per-bot Linux users, GUI lease, private live view through the Worker, usage meter). Use when changing apps/backend/src/computer, the computer routes, the agent's computer tools, or the web computer panel.
---

# E2B computer (this project)

One E2B **Desktop** sandbox per user, owned by the `UserComputerDurableObject`
(`apps/backend/src/computer/user-computer.ts`, named by user id). Every bot of that user
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
- **Isolation between bots** is OS level: each bot is a Linux user `u_<24 hex of bot id>` with a 700 home.
  Deep Agents' own `permissions` do NOT apply to sandbox backends, so do not rely on them. Verified:
  bot B gets `Permission denied` on bot A's files.
- **One mouse**: a single lease (bot id or user). Bots wait up to 20s for it; the user's "Take control"
  takes it (heartbeat every 15s, 5 min expiry).
- **Live view**: noVNC through `routes/computer.ts` (`/computer/stream/:mode/:userId/:token/*`).
  `watch` = our own `x11vnc -viewonly` on 5911/6091 (read-only is enforced on the VM, not in the browser);
  `control` = 5912/6092, only while the user holds the lease. The default port 6080 is NOT usable
  until `stream.start()` runs, so do not depend on it. The token is in the path so noVNC's relative
  assets and WebSocket inherit it. The proxy returns `new Response(null, upstream)` for sockets
  (keeps the `binary` subprotocol; dropping it gives "Missing client protocol").
- **xdotool**: use `mousemove --sync` style helpers sparingly; `--sync` can stall 15s. Chrome is launched per bot
  with `--class=k4_<user> --user-data-dir=<home>/.chrome`; a cold start takes several seconds, so
  `open_url` waits for the window (`xdotool search --onlyvisible --class`).
- **Screenshots** go to the model as a transient user message (`screen-middleware.ts`), never into the
  checkpoint or the database. Coordinates are whole pixels on a 1280x800 screen; models often send fractions,
  so the validation error says so.

## Cost and abuse guards (all in the DO / guards.ts)

Daily minutes cap (`COMPUTER_MAX_MINUTES_PER_DAY`), idle pause (`COMPUTER_IDLE_MINUTES`), per-run action cap,
90 actions/min, 4 parallel execs, URL guard (http/https, no private/metadata hosts, optional allowlist),
key-combo guard, secret/card detector for typed text, output caps. Only `POST /computer/wake` and a bot's
first tool call can start billing. Never leave a sandbox running after a test: pause or kill by id
(`e2b sandbox kill <id>`), never `--all`.

## Testing

`bun run check` in `apps/backend` runs the guard checks. The real VM flow is exercised with `wrangler dev`
plus a signed-in test user: wake, run a bot task, open the live view, take control, then pause.
