# K4 Bot — Implementation Plan (Round 6)

Status (2026-11-09, end of the second implementation session): **done except the items marked below**. Uncommitted.

| Item | State | Notes |
|---|---|---|
| P0 #9 #12 #16 #18 #20 #21 #22 #23 #24 #28 | Done | #24: the meter now says "Free model, not counted"; all of the user's recent usage was on `openrouter/free` |
| P1 #4 data mapping (pills, drag & drop, "+" picker) | Done | TipTap `TemplateInput` in every template field |
| P1 #5 placeholder rules | Done | `placeholderFor` + check; the data audit (P11) is not done |
| P1 #13 share dialog | Done | |
| P1 #11 three-pane layout, pin data, test step | Done | Widen button (≥ 1280 px) → Input · Settings · Output; Pin / Unpin; "Test this step" (stops after the block, reuses earlier outputs). Required fields first / optional folded already existed |
| P2 #8 webhook auth, IP allowlist, call log, samples | Done | Test run can "Use the last real request" (from the latest real run); no live listening mode |
| P2 #10 approvals page, bot notice, timeout action | Done | approval card inside the bot chat not built (the bot is told and tells the user) |
| P2 #3 #7 typed If, Switch, Merge, Split/Aggregate, Formatter, loop "done" output, HTTP extras | Done | Merge; List tools (split out, pluck, sum/avg/min/max, count, sort, group by, unique, first N); For each "done" output with `results`; HTTP query params + sign-in presets; manual trigger form; app-event test sample. Not built: If condition groups, typed Set fields, Delay "until", HTTP pagination, Code block |
| P3 #1 ownership rules, connect-apps card | Done | |
| P4 #25 real "@" menu, #32 avatar bubbles, #33 to-do panel | Done | mic now uses browser speech recognition |
| P4 #26 mention highlighting | Partly | highlighted text, no logos inside the input (needs a rich editor) |
| P5 #27 automatic memory with Undo | Done | not live-tested (OpenRouter key expired) |
| P6 #19 VM accounts list + delete; #17 plugins tabs | Done | |
| P7 #15 per-account browser profiles | Done (backend) | `open_app_in_browser` tool; profile per account; wiped on disconnect/expiry. No Connect-page "Log in on bot's PC" button: the bot asks the user to take control. Not live-tested |
| P8 #29–#31 bot groups | Done | Groups in the sidebar (avatar stack), lead bot, `@bot:name` routing, `message_bot` hand-offs (≤ 8 per message), `update_group_memory`, per-member agent state, author avatars, folded work rows named by bot. Group facts are not auto-learned (bots save them with the tool). Not live-tested |
| P9 #34 admin bot | Done | "Add an admin bot" in the sidebar; admin_* tools (bots, memory, groups, message a bot, `admin_run_as_bot` runs as the other bot's Linux user, refused while it works); all workflows; `admin_audit` log (no UI yet). Not live-tested |
| P10 #35 Decide (Jev) block | Done | not live-tested (no TypeSafe key) |
| P11 #2 #5 Composio schema audit script | Script done | `bun run composio:audit`; not run yet, results not applied |

Migrations applied to the dev database: `0019` (memory_event), `0020` (webhook_request), `0021` (bot groups, bot.kind, admin_audit, chat_thread.group_id, chat_message.author_bot_id).
Source: the user's 35-item request (2026-11-09), their answers to clarifying questions (§2), a read of the codebase,
and research (§17). Read `docs/README.md` first: it describes the system as it is today.

---

## 1. How to use this plan

- Work **phase by phase** (§5). Each phase ends with its acceptance checks green before the next starts.
- Each work item has: **Why** (the user's problem), **Findings** (what the code does today), **Design**, **Files**,
  **Done when** (acceptance criteria). Item numbers `#N` are the user's numbering.
- **Never remove an existing feature (#6).** Change behaviour only where an item says so.
- Ask the user before deviating from a decision in §2.
- After each phase: `bun run check-types` (both apps), `bun run check` (backend), Biome on touched web paths, a browser
  check in light **and** dark mode at 1440 px and 800 px widths, then update `docs/`.

## 2. Decisions already made by the user (do not re-ask)

| Topic | Decision |
|---|---|
| #15 Bot browser logins | **Per-account browser profiles** on the bot's PC: the user logs in once inside the bot's browser; disconnecting the app on Connect wipes that profile; the bot asks which account when there are several. (A Composio connection is an API token and cannot log a browser into a website.) |
| #34 Admin bot scope | **Only the user's own bots.** One admin bot per user. Never cross-user. |
| #35 Jev access | **TypeSafe directly** (`TYPESAFE_API_KEY`, official TS SDK `@typesafe-ai/sdk`). |
| #35 Jev MCP | **Skill only, no MCP.** The `langgraph-decision-models` skill is already in `.claude/skills/`. Do not add the community `jev-mcp` server. |
| #27 Auto memory | **Auto-save with notice**: a post-turn check decides what to remember and where (bot vs global), saves it, and shows "Memory updated" with **Undo**. |
| #29 Group replies | **A lead bot** per group answers un-mentioned messages and may delegate. |
| #29 Group size | **No product limit** on bots per group (cost is bounded by the existing daily token budget). |
| Plan | **Plan only**; hand over to an implementing agent. |

## 3. Engineering rules (apply to every change)

| Rule | Detail |
|---|---|
| File size | **≤ 150 lines per source file** (raised from 100 by the user). Exempt: `components/ui/*` (shadcn), generated files |
| Structure | Backend `apps/backend/src/modules/<feature>/`, web `apps/web/src/features/<feature>/`; pages in `app/` stay thin |
| SOLID, pragmatically | One responsibility per file; depend on small interfaces (e.g. a `Notifier`, a `ConnectionChecker`); no class hierarchies unless the module already uses them (the computer DO does) |
| Reuse | Build shared components once (§4.3) and use them everywhere; no copy-paste between blocks |
| Libraries first | Prefer the platform/library feature over custom code (§4.4). Read the library's docs before using it |
| Boundaries | zod on every input; every query scoped to the session user; other users' ids → 404 |
| Prompts | Every model-facing text in `apps/backend/src/prompts/` |
| Tests | A `*.check.ts` for every non-trivial pure function; register in `apps/backend/package.json` |
| UI | shadcn on Base UI (`render={<Link/>}` + `nativeButton={false}`, never `asChild`), theme tokens only, sonner toasts with ids |
| Security | §16 (OWASP Top 10 2025 + OWASP Top 10 for LLM Applications 2025) checked per phase |

## 4. Target architecture

### 4.1 New and changed backend modules

```
apps/backend/src/modules/
├── groups/            NEW  bot groups: CRUD, membership, lead, group threads, @bot routing, group memory
├── admin-bot/         NEW  the per-user admin bot: privileged tools (bots, groups, memories, PC accounts)
├── browser-profiles/  NEW  per-account browser profiles on the bot PC; wipe on disconnect
├── decisions/         NEW  TypeSafe Jev client wrapper (SDK), question schema, usage + caps
├── memory/            CHANGED  + auto-memory extractor (post-turn), undo log
├── workflows/         CHANGED  new blocks, typed conditions, webhook auth/test mode, approvals inbox
├── composio/          CHANGED  connection requirements check, placeholder rules, schema audit script
├── computer/          CHANGED  accounts list/delete, real reset, super-bot access tier
├── chat/              CHANGED  group threads, file-cards-after-run, todo state events, mention parsing
└── agent/             CHANGED  workflow ownership rules, connect-apps tool, inter-bot tools, auto-memory hook
```

### 4.2 New and changed web features

```
apps/web/src/features/
├── groups/            NEW  group list/create, group chat view, avatar stack, @bot mentions
├── mentions/          NEW  the rich input (TipTap) shared by the prompt bar and workflow fields
├── workflows/builder/ CHANGED  field mapper (drag & drop + "+" picker + token pills), redesigned blocks
├── chat/              CHANGED  message bubbles with bot avatar, pinned animated to-do panel, file grid, @ menu
├── computer/          CHANGED  accounts tab, collapsible side column on small screens
├── admin/             NEW  admin bot settings surface (reuses bots UI)
└── connect/           CHANGED  plugins dialog in Tabs, "log in on the bot PC" per account
```

### 4.3 Shared components to build once

| Component | Used by |
|---|---|
| `TemplateInput` (TipTap-based single/multi-line field that renders `{{…}}` as pills with the source block's icon and accepts drops and "+") | every workflow text field (#4) |
| `DataPicker` (searchable tree of earlier blocks' fields, opens from "+", inserts at the caret) | `TemplateInput`, condition rows, loop list, AI prompt |
| `MentionInput` (TipTap + Mention suggestion: `@`/`/` menus, chips with icon/logo) | prompt bar (#25, #26), group chat (#29) |
| `AppBadge` (logo + name + status) | connect cards, chat "connect apps" card (#1), @ menu |
| `ConfirmDangerDialog` (destructive confirmation with typed name) | VM account delete (#19), reset (#22), admin deletes (#34) |
| `AvatarStack` (shadcn Avatar group of bot avatars in a circle) | groups (#31), message bubbles (#32) |

### 4.4 Libraries to use (read their docs first)

| Need | Library | Notes |
|---|---|---|
| Rich inputs with mentions and token pills | `@tiptap/react`, `@tiptap/starter-kit` (minimal), `@tiptap/extension-mention`, `@tiptap/suggestion` | One editor wrapper serves #4, #25, #26. Serialize to plain text with `{{…}}` / mention markers; never store HTML |
| Drag and drop of fields | Native HTML5 DnD (`dataTransfer`) into TipTap's drop handler | What n8n does; no extra library |
| To-do panel animation | shadcn `Collapsible` (Base UI) with height transition | #33 |
| Group/Bot avatars | shadcn `Avatar` + `AvatarGroup` pattern | #31 |
| Chat bubbles | shadcn `ai-elements` `Message` components already in `components/ai-elements` | #32 |
| Tabs | shadcn `Tabs` (already installed) | #13, #17, #19 |
| Decision model | `@typesafe-ai/sdk` (`TypeSafeClient.systemOne`) | #35; pin the version; it is new |
| Agent to-do list | `deepagents` `createDeepAgent` already includes `todoListMiddleware` (`write_todos`) | #33 is UI + enforcement |
| Time zones | existing `modules/schedules` | unchanged |
| Webhook signatures | Web Crypto `HMAC` (already used in `composio/verify-event.ts`) | #8 |

### 4.5 Data model changes (Drizzle migrations, one per phase)

| Table / column | Phase | Purpose |
|---|---|---|
| `bot.kind` enum `normal \| admin` (default `normal`), unique partial index one admin per user | P9 | #34 |
| `bot_group` (id, user_id, name, lead_bot_id, memory text, created_at) | P8 | #29 |
| `bot_group_member` (group_id, bot_id, added_at) | P8 | #29 |
| `chat_thread.group_id` nullable FK (a group thread has `bot_id` = lead) | P8 | #29 |
| `chat_message.author_bot_id` nullable | P8 | which bot wrote a group message (#30, #32) |
| `bot_workflow.created_by_bot` (exists) used for ownership rules | P3 | #1 |
| `workflow` webhook settings live in the trigger block config (no column) + `webhook_test_until` timestamp | P2 | #8 |
| `webhook_request_log` (workflow_id, at, ip_hash, status, reason) pruned after 7 days | P2 | #8 |
| `memory_event` (id, user_id, bot_id nullable, scope, before, after, created_at) | P5 | #27 undo |
| `browser_profile` (id, user_id, bot_id, toolkit, connected_account_id, path, last_login_at) | P7 | #15 |
| `decision_usage` rows in `agent_usage` with `model = typesafe/<id>` | P10 | #35 caps |

## 5. Phases (in order)

| Phase | Theme | Items |
|---|---|---|
| P0 | Bugs and quick fixes | #9, #12, #16, #18, #20, #21, #22, #23, #24, #28 |
| P1 | Workflow editor UX foundations | #4, #5 (rules), #13, #11 (layout) |
| P2 | Blocks and triggers to n8n/Zapier level | #3, #7, #8, #10, #11 |
| P3 | Bots ↔ workflows | #1 |
| P4 | Chat UX | #25, #26, #32, #33 |
| P5 | Automatic memory | #27 |
| P6 | Computer (VM) management | #19, #22 (done in P0), #34 (access tiers groundwork) |
| P7 | Per-account browser profiles | #15 |
| P8 | Bot groups | #29, #30, #31 |
| P9 | Admin bot | #34 |
| P10 | Jev decision block | #35 |
| P11 | Composio schema audit and placeholders | #2, #5 (data) |
| — | Research summary and references | §17 |

---

## 6. P0 — Bugs and quick fixes

### #9 Duplicate React keys in conditions
- **Findings:** `condition-settings.tsx` keys rows by content (`${left}|${op}|${right}`); two empty rows collide.
- **Design:** give each condition a stable `id` (nanoid) in the web model; strip/keep on save (add optional `id` to
  `conditionSchema`, max 40 chars). Same fix anywhere rows are keyed by content (Set fields, HTTP headers).
- **Done when:** adding two empty conditions shows no console error; reordering keeps focus.

### #12 Account section shown for apps that need no login
- **Findings:** 34 of 1,723 toolkits are `no_auth` (e.g. `composio`, `composio_search`, `hackernews`). Round 5 made
  `AppConnection` say "No login needed", but the **Account** section header still renders.
- **Design:** `AppSettings` hides the whole Account section when `useNoAuth(toolkit)` is true; the library shows a
  "No login" badge on such apps.
- **Done when:** a `composio` action block shows no Account section and runs without a connection.

### #16 File cards appear mid-run and only as a list
- **Findings:** generated files render as soon as their tool part finishes (`agent-parts/work-steps.tsx`,
  `message-item.tsx`); `files/components/file-list.tsx` lays answers out in a column.
- **Design:** collect the run's file parts and render them **after the final answer** when the run status is done
  (while running, show a compact "1 file ready" chip in the work steps). Layout: CSS grid
  `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`; keep `FileCard` unchanged.
- **Done when:** during a run no big cards appear; after it, 3 files show in a 3-column grid on desktop.

### #18 Full-screen computer on small screens
- **Design:** in `ComputerPanel` full-screen, below `lg` the side column (Activity) is hidden by default; add a toggle
  button next to "Give control back" (`PanelRightOpen/Close`), visible only below `lg`.
- **Done when:** at 800 px the screen uses the full width; the toggle shows/hides Activity.

### #20 noVNC asset 502s in the log
- **Findings:** the log shows assets loading, then `POST /computer/pause`, then 502s. Pausing kills the VM while the
  iframe is still fetching its scripts; the proxy's 20 s target cache still points at the dead host.
- **Design:** on pause/reset, the DO broadcasts state; the panel unmounts the iframe immediately when the state is not
  `running`; the proxy clears `targets` for the user on any non-`running` state and answers asset requests for a
  paused computer with `409 asleep` (not 502).
- **Done when:** pausing while the viewer loads produces 409s at most, no 502s, and the panel shows the asleep card.

### #21 Collapsed sidebar: bot icons, hover, overflow
- **Findings to confirm (not yet verified in code):** likely the bot rows in `nav-projects.tsx` don't use
  `SidebarMenuButton` with `tooltip`, so the collapsed (icon) sidebar hides them and loses hover; the theme button
  text ("to light mode") overflows when collapsed (screenshot 3).
- **Design:** render bots with `SidebarMenuButton tooltip={name}` and the bot avatar as the icon; theme toggle shows
  only its icon when collapsed (`group-data-[collapsible=icon]` utilities).
- **Done when:** collapsed sidebar shows bot avatars with hover state and tooltips; no clipped text.

### #22 Reset must destroy and recreate the computer
- **Findings:** `durable/session.ts reset()` kills the sandbox and leaves the computer `off`; a new VM is made only on
  the next wake, so it looks like nothing happened.
- **Design:** after the kill, immediately provision a new sandbox (the same path as first-time provisioning in
  `power.ts provision()`), re-create bot accounts lazily on first use, and report progress ("Creating a new computer…")
  over the status socket. Keep the existing "bots are working" confirmation. Use `ConfirmDangerDialog`.
- **Done when:** after Reset the panel goes off → starting → running with a fresh disk; old files are gone.

### #23 Bot picker shows the bot's id
- **Findings:** Base UI `SelectValue` renders the raw value unless given children.
- **Design:** `<SelectValue>{bots.find(b => b.id === botId)?.name}</SelectValue>`; audit every `SelectValue` in the
  app for the same bug.
- **Done when:** the Ask a bot block shows the bot's name.

### #24 Daily usage meter not updating / "left" missing
- **Findings to confirm:** `usage-meter.tsx` reads `usage.todayUsed/todayLimit`, set from history and from live
  `usage` events (`chat/run/usage-events.ts`). Trace whether the live event still includes `todayUsed` after the
  free-model change, and whether the meter hides "left" on narrow widths.
- **Done when:** the meter shows `used / limit · N left` and updates after every model call.

### #28 Create avatar → go to the new bot
- **Design:** after `POST /bots` succeeds, `router.push(/dashboard/bot/<id>)`.
- **Done when:** creating a bot lands on its chat.

---

## 7. P1 — Workflow editor UX foundations

### #4 Map data without copying `{{…}}` by hand
- **Design (n8n's model, see §17):**
  1. Every text field becomes a `TemplateInput` (§4.3): references render as **pills** ("Gmail · subject") instead of
     raw `{{steps.gmail_16m9p.output.data.subject}}`; the stored value stays the same template string.
  2. **Drag** any field from the Data tab (and from an expanded Last run output) onto a field: it inserts at the drop
     point.
  3. A **"+" button** in every field opens `DataPicker` (searchable tree: trigger, each earlier block, loop item),
     inserting at the caret.
  4. Typing `{{` opens the same picker inline.
  5. Pills show a tooltip with the full path and the last run's value; broken references (block deleted) render red
     and appear in the issues menu.
- **Files:** `features/mentions/` (editor wrapper), `builder/settings/template-input.tsx`, `data-picker.tsx`,
  `field-drag.ts`; replace inputs in schema fields, HTTP, Set, conditions, AI prompt, approval message.
- **Done when:** a user builds Gmail → Sheets mapping without typing a brace; existing workflows load unchanged.

### #5 Placeholders and hints that are correct (rules part)
- **Findings:** placeholders come from Composio schema `default` and `examples`; some examples contradict the type or
  the default (Round 5 fixed one case in `schema-field-text.tsx`).
- **Design:** one pure function `placeholderFor(schema)` with ordered rules, unit-tested:
  default (if type-valid) → first example that validates against the field's type/format/enum → format-based hint
  (`email`, `uri`, `date-time`, `date`) → nothing. Never show an example that fails validation. Hints: description
  (Markdown stripped), type, default, allowed values, required. The data part of #5 is P11.
- **Done when:** `placeholder.check.ts` covers each rule; the P11 audit report shows zero invalid placeholders.

### #11 Block settings layout (reference: n8n NDV, Zapier step editor)
- **Design:**
  - Three-pane option when the panel is widened: **Input** (earlier data, schema/table/JSON views) · **Parameters** ·
    **Output** (last run, schema/table/JSON), like n8n's node details view. Keep the current tabs as the compact mode.
  - Parameters grouped: **Required** first, **Optional** behind "Add option" (n8n's pattern) instead of a long list.
  - Each block gets a **"Test this step"** button that runs only this block with the previous blocks' pinned data.
  - **Pin data**: pin a block's last output as sample data so editing later blocks doesn't need re-runs (n8n).
- **Done when:** the three-pane layout works at ≥ 1280 px and collapses to tabs below.

### #13 "Bots" (share) dialog redesign
- **Design:** shadcn `Dialog` with a list of bots as rows (avatar, name, role, a `Switch` "Can run"), a search box,
  a note on what sharing allows (§8 #1 rules), and **Save** / **Cancel** in the footer. Match the Connect page styling.
- **Done when:** visually consistent in light/dark; keyboard accessible.

---

## 8. P2 — Blocks and triggers to n8n/Zapier level

### #3, #7 Block feature parity (each item is one block's spec)

| Block | Today | Target (n8n / Zapier reference) |
|---|---|---|
| **If** | text conditions, all/any | Typed conditions (string, number, date & time, boolean, array, object) with n8n's operator set per type (§17), **condition groups** (AND/OR nesting one level), "convert types where required" toggle, case-insensitive option |
| **Switch** (new) | — | Multiple outputs by rules or by an expression value, a fallback output; ordered rules |
| **Filter** | stop path | Same typed conditions; optional "discarded items" output |
| **For each** | one list, all blocks after it | n8n "Loop Over Items" semantics: a **loop body** and a **done** output (blocks after "done" run once with all results), batch size, "continue on item error", results collected as `{{steps.loop.output.results}}` |
| **Split out / Aggregate** (new) | — | Turn a list field into items / collect items into a list (pairs with For each) |
| **Merge** (new) | — | Wait for two branches; modes: append, combine by key, choose branch |
| **Set fields** | key = text | Typed fields (string/number/boolean/array/object), "keep only set fields" vs "include input" |
| **Delay** | duration | + "until a date/time", + "until a weekday/time" |
| **Formatter** (new, Zapier) | — | Text (case, trim, replace, extract email/URL/number), numbers (format, math), dates (format, add/subtract, time zone), lists (join, split, pick) — pure functions, unit-tested |
| **Code** (new, optional — ask user) | — | JavaScript in the E2B sandbox only (never `eval` in the Worker); time and memory capped |
| **HTTP request** | basic | + query params editor, auth presets (Bearer from a secret, Basic, header), pagination helper, response "full response" option |
| **Ask a bot** | text/JSON | + JSON schema builder for structured output, model override, "show reasoning" |
| **Ask me first** | approve/decline in builder | see #10 |
| **Triggers** | manual, schedule, webhook, app event | + manual trigger **input form builder** (fields with types), + "test event" capture for app events (fetch a recent sample via Composio where the trigger supports it) |

- **Engine:** typed comparisons in `engine/conditions/` (one file per type, pure, tested); new blocks in
  `graph/blocks/<name>.ts` (schema) + `engine/blocks/<name>.ts` (run) + web settings component, per the "adding a
  block" recipe in `docs/guides/development.md`.
- **Done when:** each new/changed block has check scripts, a web settings UI, bot help text in
  `prompts/workflow-tools.ts`, and an end-to-end run.

### #8 Webhooks: clarity, validation, security, rate limiting
- **Findings (today):** the URL has a 256-bit secret token (only its hash is stored); POST + JSON only; 256 KB;
  **60 runs/min per workflow** (`RL_WF_HOOK`) plus 500 runs/day and 5 concurrent per user; failures return 404. So it
  is not open to unlimited spam today, but it lacks: a test mode, auth options, docs in the UI, request visibility.
- **Design (n8n Webhook node parity, §17):**
  - **Test URL vs production URL:** "Listen for test event" registers a test URL for 2 minutes; the captured request
    shows in the builder as sample data (and fills the Data tab).
  - **Auth options:** none (token in URL, default) · header secret · Basic · **HMAC signature** (header name, algorithm
    SHA-256, secret from the vault, timestamp tolerance) for providers like Stripe/GitHub.
  - **Options:** allowed methods, IP allowlist (CIDR), "only run if" condition, response mode (immediately / after the
    last block with its output), response status code.
  - **Visibility:** a "Requests" tab: last 50 attempts (time, status, reason: bad token, rate limited, too large…),
    hashed IP; pruned after 7 days.
  - **Abuse:** keep per-workflow limit; add a per-IP limit for the hooks route; repeated bad tokens from one IP are
    blocked for 15 minutes.
  - **UI text:** a "How to call this" panel with curl, JavaScript and Python samples using the real URL.
- **Done when:** a Stripe-style signed request works, an unsigned one is rejected with 401, the Requests tab shows
  both, and the test URL captures a sample.

### #10 "Ask me first": purpose and bot integration
- **Today:** a workflow block that pauses a run until the user approves in the builder.
- **Design:** an **Approvals inbox**:
  - A bell in the sidebar with a count; `/dashboard/approvals` lists waiting approvals across workflows.
  - If the run was started by a bot (or the workflow is shared with one), the approval also appears as an
    Approve/Decline card in that bot's chat.
  - Options per block: reviewer message, timeout + action on timeout (fail / continue / decline), reminder.
  - Approve/decline from the inbox, the chat card, or the builder — one shared answer endpoint (exists).
- **Done when:** a bot-started run that reaches the block shows a card in the bot's chat; answering it resumes the run.

---

## 9. P3 — Bots ↔ workflows (#1)

- **Missing connections:** before creating or turning on a workflow, the bot calls a new read-only tool
  `check_app_connections({ toolkits })` (also run automatically inside `create_workflow`/`turn_on_workflow`, which list
  every `toolkit` used by `action.app` and `trigger.app` blocks). Missing ones → a new **interrupt** that renders a
  **"Connect apps" card** in the chat: one row per app (`AppBadge`: logo, name, Connect button using the existing
  `authorizeApp` with `returnTo` = the chat). The run waits durably; when every app is connected (poll on return or
  "I've connected" button) it resumes. No-login apps are skipped.
- **Ownership rules (enforced in the tools, not the prompt):**
  | Action | Workflows the bot created | Shared with the bot | Others |
  |---|---|---|---|
  | read, run | yes | yes | no (404) |
  | update, turn on, turn off, delete | yes | **no** | no |
  New tool `delete_workflow` (own only, asks in Ask mode). Admin bot (P9) is the only exception.
- **Done when:** "fetch my 2 newest emails and save them to Google Sheets" with Sheets not connected shows the card;
  connecting resumes the bot; trying to turn off a shared workflow is refused.

## 10. P4 — Chat UX

### #25 The "@" menu with real data
- **Findings:** `prompt-bar/data.ts` holds placeholder entries ("Scoop Data", "Flavor records", Figma…).
- **Design:** replace with live categories (arrow-key navigation, type-to-filter, a "More" submenu per category):
  **Files** (recent + upload) · **Apps** (connected first, then all; unconnected show "Connect" inline) · **Workflows**
  (shared/own) · **Skills** · **Commands** (`/deep-research`, `/compact`, …) · in groups only: **Bots** (`@bot:name`).
  Selecting inserts a typed mention the backend understands (file id, toolkit, workflow id), passed to the run as
  structured context, not just text.
- **Done when:** every entry does something real; no dummy data remains.

### #26 Mention chips styling
- **Design:** `MentionInput` renders mentions as chips (icon/logo + label, accent background) like the user's
  screenshots; same chip in the sent message bubble.

### #32 Message bubbles with bot avatar
- **Design:** assistant messages render as `[avatar] [work steps (collapsible parent → children)] [answer]` using
  `ai-elements` `Message` + avatar; user messages right-aligned bubbles. In groups each bubble shows the author bot.

### #33 Pinned to-do panel
- **Findings:** `createDeepAgent` already adds `todoListMiddleware` (`write_todos`) and a todo guard exists; todos
  render only inside a tool step.
- **Design:** a panel docked above the prompt bar (like the user's images 8–10): header "To-dos · N in progress · M
  pending", chevron; shadcn `Collapsible` with a sliding height animation; items with status icons (spinner / dot /
  check). It reads the latest `write_todos` state of the current run (live events) and hides when the run ends with all
  items done. Keep the in-line render too (#6).
- **Done when:** a multi-step task shows the panel updating live with smooth open/close.

## 11. P5 — Automatic memory (#27)

- **Design:** after each finished run, a post-turn job (in the chat run workflow, a separate durable step, never blocking
  the answer) asks a small model **or Jev** (P10; choose Jev `noul`/`choice` when available: cheaper, typed) three
  questions about the last user message and answer: *Is there a durable fact or preference?*, *Is it about this bot's
  work or the user in general?*, *Does it contradict existing memory?* If yes, a model call writes the concise
  update; save it to `bot_memory` or `user_preferences`; record a `memory_event` (before/after); publish a
  "Memory updated" event → toast with **Undo** (restores `before`).
- **Validation:** never store secrets/credentials (regex + the existing redaction), never store content from tool
  results/app data (prompt-injection; LLM04 poisoning), cap memory size, rate-limit to 1 update per turn.
- **Done when:** "I prefer short answers" updates global preferences with a toast; Undo restores it.

## 12. P6 — Computer (VM) management (#19, groundwork for #34)

- **#19 Accounts tab** on `/dashboard/vm`: list Linux users on the computer (from the DO's `botUsers` + `getent`
  check): username, bot (avatar/name), home size, last active. Each row: **Delete** → `ConfirmDangerDialog` ("Deleting
  this account deletes the bot <name>, its chats and files on this computer"). Implementation calls the existing
  delete-bot path (which already removes the account). Accounts without a bot (orphans) can be removed directly.
- **Permissions recap (today):** each bot's home is private (`chmod 700`); other bots cannot read it. Keep that
  (the user said "can only read it" — confirm in implementation: today bots **cannot** read each other's homes; the
  super-bot tier in P9 is the one that can).

## 13. P7 — Per-account browser profiles (#15)

- **Why not "reuse the Connect login":** Composio stores OAuth tokens for API calls; websites need session cookies.
  There is no supported way to turn a Composio connection into a browser login.
- **Design:**
  - A profile = a Chromium user-data dir in the bot's home: `~/.k4/profiles/<toolkit>/<connectedAccountId>`
    (`browser_profile` row). One per bot × app account.
  - **Connect page:** each connected account gets "Log in on <bot>'s PC" → wakes the computer, opens the app's login
    URL in that profile on the bot's display, and the user takes control (existing lease) to log in once.
  - **Bot tool** `browser_open_app({ toolkit, account? })`: opens the app in its profile. If the user has several
    accounts for the app, the tool returns them and the bot asks which one (`ask_user`), unless the task names it.
  - **Disconnect sync:** `DELETE /composio/connections/:id` and the `composio.connected_account.expired` event delete
    that account's profiles on every bot PC (a queued job if the computer is asleep; done on next wake).
  - Login URL per toolkit: from Composio toolkit metadata where present, else a small mapping for the top apps, else
    ask the user.
- **Security:** profiles are per bot (private home), never shared; cookies never leave the VM; deleting a bot deletes
  its profiles.
- **Done when:** after logging in once, the bot opens Gmail logged in; disconnecting Gmail on Connect logs it out there.

## 14. P8 — Bot groups (#29, #30, #31)

- **Model:** `bot_group` (name, lead bot, group memory) + members; a group thread is a `chat_thread` with `group_id`.
- **Routing:** a message with `@bot:name` mentions goes to those bots (in order); without mentions it goes to the
  **lead**. Each addressed bot runs its normal chat run against the group thread with: the group memory, the member
  list, and inter-bot tools.
- **Inter-bot tools (groups only):** `message_bot({ bot, text })` (posts in the group as the bot and triggers the
  target's run), `share_file_with_bot`, `handoff({ bot, task })`. Loop guard: max 8 bot-to-bot hops per user message;
  each hop counts toward the daily budget.
- **UI:** group list in the sidebar with `AvatarStack` (#31); group chat shows each message with its author's avatar
  (#32); work steps of a group message are **collapsed by default** with the working bot's name in the header (#30);
  `@bot:` mentions only in group chats (#29).
- **Memory:** `bot_group.memory`, updated by the auto-memory job (P5) for group-scoped facts.
- **Done when:** a group of 3 bots handles "@bot:researcher find X, then @bot:writer draft it" with visible handoffs.

## 15. P9 — Admin bot (#34) and P10 — Jev block (#35)

### P9 Admin bot (per user)
- **One per user** (`bot.kind = admin`), created from a dedicated entry on the dashboard; cannot be deleted by other
  bots.
- **Tools (asks first in Ask mode):** list/create/update/delete bots, update bot memory, create/manage groups, message
  any of the user's bots, manage workflows of any bot (the ownership exception in §9).
- **PC access tiers:**
  | Tier | Access |
  |---|---|
  | Human (the user, via control) | Full; root via the desktop |
  | Admin bot | Read/write other bots' homes through group ACLs (`setfacl`), **no** user deletion. Before deleting another bot's files: check the bot is idle (DO `working()`); if busy, refuse; if idle, ask that bot (`message_bot`) and the user before deleting |
  | Normal bot | As today: own home only |
  Deleting a normal bot deletes its Linux user (exists).
- **Safety:** every admin action recorded in an `admin_audit` table; destructive tools always ask, even in Allow all.

### P10 Jev decision block (TypeSafe)
- **Facts (docs.typesafe.ai):** `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer`; body
  `{ model, state, questions, assets? }`; question types `noul` (yes/no probability, optional `criteria.true/false`),
  `choice` (`criteria` 1–255 labels → descriptions), `score` (`criteria` 1–10 ordered levels), `box` (image region);
  response `answers.<id>` with `noul` / `choice`+`confidence`+`probabilities` / `score`+`confidence`+`legend`;
  `usage`. Errors 400 (application) and 422 (validation). Models via `GET /v1/models` (`jev-latest`, `jev-preview`;
  responses name the concrete version, e.g. `jev-1.13.0`). Official TS SDK `@typesafe-ai/sdk`.
- **Block "Decide (Jev)":**
  - Settings: model (pinned id from `/v1/models`, default `jev-latest`), **State** (`TemplateInput`, filled values
    wrapped as data), **Questions** list (id, type, instructions, criteria editor per type), outputs.
  - Outputs: one per question; `{{steps.x.output.<id>.noul}}`, `.choice`, `.score`, `.confidence`, `.probabilities`.
  - **Route by decision:** an optional built-in router (like Switch) with **bands**, not equality (the skill's three
    traps: `score` is an expected value; confidence measures shape; thresholds don't transfer between models).
  - Validation: at least one question; criteria limits; question ids `[a-z_]{1,40}`; state ≤ 100 KB.
- **Backend:** `modules/decisions/` (client wrapper via SDK, zod schemas, usage → `agent_usage`, daily cap
  `MAX_DECISIONS_PER_DAY`), `engine/blocks/decision.ts`. Env `TYPESAFE_API_KEY` (optional; feature off without it).
- **Bot description for specialised blocks:** in `prompts/workflow-tools.ts`, a section per specialised block (Jev,
  Ask a bot, Formatter, Switch…) telling bots when to use it and how to read its output. Files: that prompt file plus
  a `docs/features/decision-block.md`.
- **Done when:** a "triage email" workflow routes by a Jev `choice` with a confidence band; the block is in the bot's
  workflow help.

## 15b. P11 — Composio schema audit (#2, #5 data)

- Reading 1,723 toolkits by hand is not feasible; do it **programmatically**, once, offline:
  `apps/backend/scripts/composio/audit-schemas.ts` pages through every toolkit's tools and triggers
  (`getRawComposioTools({ toolkits, important: false })`, `triggers.listTypes`), respecting rate limits, and writes a
  report (`scripts/composio/report.json` + summary): auth schemes per toolkit, fields whose default/example fails
  their type, missing descriptions, `file_uploadable` fields, enum-like strings.
- Feed the findings into `placeholderFor` rules (P1) and a small per-field override map for proven-wrong upstream
  schemas (`composio/placeholder-overrides.ts`), reported upstream to Composio.

## 16. Security checklist (OWASP Top 10 2025 + OWASP LLM Top 10 2025)

| Risk | Where it applies in this plan | Control |
|---|---|---|
| A01 Broken Access Control | groups, admin bot, workflow ownership, VM accounts, profiles | server-side ownership checks in every tool and route; cross-user tests (B gets 404 on A's ids) |
| A02 Security Misconfiguration | webhooks (CORS, methods), new env keys | defaults closed; feature off when key missing |
| A03 Software Supply Chain | TipTap, `@typesafe-ai/sdk` | pin versions; lockfile committed (restore `bun.lock`, deleted in e5a105b); no community MCP |
| A04 Cryptographic Failures | webhook HMAC, secrets | Web Crypto HMAC, constant-time compare, vault secrets |
| A05 Injection | Code block, condition regex, shell for profiles/ACLs | no `eval` in the Worker; regex with timeouts/length caps; shell args via existing quoting guards |
| A06 Insecure Design | inter-bot loops, auto memory | hop caps, rate limits, undo log |
| A07 Authentication Failures | webhooks auth options | per-IP limits, bad-token lockout |
| A08 Software/Data Integrity | memory updates, pinned data | validate before save; memory events auditable |
| A09 Logging & Alerting | admin actions, webhook rejects | `admin_audit`, `webhook_request_log` |
| A10 Exceptional Conditions | every durable step | fail closed; clear user errors; no stuck states |
| LLM01 Prompt Injection | group messages, mentions, app data in Jev state | data wrapped as data; bots treat other bots' messages as data |
| LLM02 Sensitive Info Disclosure | memory, profiles, logs | redact secrets; never store cookies outside the VM |
| LLM03 Supply Chain | skills, models | catalog-only skills; pinned model ids |
| LLM04 Data & Model Poisoning | auto memory | only from user messages, not tool output |
| LLM05 Improper Output Handling | Jev/AI outputs feeding blocks | typed outputs, schema validation before use |
| LLM06 Excessive Agency | admin bot, inter-bot tools | approvals for destructive tools in every mode |
| LLM07 System Prompt Leakage | prompts | no secrets in prompts |
| LLM08 Vector/Embedding | (none planned) | — |
| LLM09 Misinformation | Jev routing | bands + human review branch |
| LLM10 Unbounded Consumption | groups (no size limit), decisions | daily token/decision caps, hop caps, per-run limits |

## 17. Research notes and sources

- **TypeSafe Jev:** [Quick start](https://docs.typesafe.ai/introduction/quickstart), [API reference](https://docs.typesafe.ai/api),
  [LangSmith decision models](https://docs.langchain.com/langsmith/llm-gateway-decision-models), skill
  `.claude/skills/langgraph-decision-models` (Python examples; translate to the TS SDK). Community MCP
  [freepik-company/jev-mcp](https://github.com/freepik-company/jev-mcp) — **not** to be installed (§2).
- **Grok Bot (groups, coordination):** [docs.x.ai/grok-bot/bots](https://docs.x.ai/grok-bot/bots),
  [xAI enterprise news](https://x.ai/news/grok-bot-for-enterprise); bots share one computer per member, coordinate in
  group chats with @-mentions and handoffs. No documented "admin bot"; P9 is this product's own design.
- **n8n:** [Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) (test vs
  production URL, auth: basic/header/JWT, respond modes, IP allowlist, only-run-if, CORS),
  [If node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.if/) (typed operators),
  [data mapping UI](https://docs.n8n.io/data/data-mapping/data-mapping-ui) (drag fields into parameters).
- **Zapier:** [Human in the Loop](https://help.zapier.com/hc/en-us/articles/38733184458765/) (timeouts, reminders,
  approve/collect data), Formatter, Paths, Looping.
- **LangChain:** [built-in middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
  (`todoListMiddleware` adds `write_todos`; Deep Agents includes it).
- **Composio + browsers:** [how Composio works](https://docs.composio.dev/docs/how-composio-works); OAuth tokens serve
  API calls, browser logins need profile cookies (basis for §13).

## 18. Open questions for the implementer to raise with the user

1. #7 Code block: allow user JavaScript (runs in the E2B sandbox, costs sandbox minutes)? Not decided.
2. #34: may the admin bot read *every* bot's chat history, or only memories and files?
3. #10: should approvals also notify by email (Resend) when the user is away?
4. `bun.lock` was deleted in commit e5a105b: restore it (`git checkout e5a105b~1 -- bun.lock`) or regenerate and commit.
