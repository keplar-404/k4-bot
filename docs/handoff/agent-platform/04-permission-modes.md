# 04 — Permission modes: Allow all · Plan · Ask (build this first)

The user's spec: a picker in the prompt bar, like the model and reasoning pickers, with three modes.
- **Allow all:** the bot does not ask; it does the work.
- **Plan:** the bot only plans and tells the user the plan. When it needs to act, it asks the user to switch mode, through a **button in the chat**. Clicking it updates the mode and the prompt bar.
- **Ask:** the bot asks before actions (the existing approval cards).

## 1. Where the mode lives (server is the source of truth)

- New column `chat_thread.mode text not null default 'ask'` (enum `allow_all | plan | ask`). Migration via `bun run db:generate`, made idempotent. **Per chat thread**, because one chat is one task. Optional later: a per-bot default (`bot.default_mode`), copied onto new threads.
- `PUT /chat/threads/:id/mode` (`authGuard`, `userLimit`, `validate("param", {id: z.string().min(1)})`, `validate("json", z.object({ mode: z.enum(MODES) }))`) → user-scoped update → `publishEvent(threadId, "thread.mode", {mode})` so other tabs update.
- `GET /threads/:id/messages` also returns `mode` (beside `usage`).
- **The run reads the mode from the DB at the start of every slice** (`runSlice` loads the thread already: `getOwnedThread`). Never take it from the send-message body: the body cannot widen it, and a mode change mid-run takes effect at the next slice.
- Shared constants: `modules/chat/modes.ts` with `MODES` and `type ChatMode` (the web imports the type via `@backend/...`).

## 2. What each mode does in the agent (`buildAgent`)

Pass `mode` through `BuildAgentOptions` (from `runSlice` → `buildRunAgent`). Create `agent/modes.ts` (pure, ≤100 lines, with a `modes.check.ts` added to `bun run check`):

```ts
export function approvalsFor(mode: ChatMode, base: Record<string, InterruptOnConfig>): Record<string, InterruptOnConfig>
export const PLAN_HIDDEN: RegExp // write tools hidden in Plan mode
```

| Mode | `interruptOn` | Tools offered | Prompt |
|---|---|---|---|
| ask | today's approvals (`fileApprovals` / `computerApprovals` / `sandboxApprovals` / MCP approvals) **plus** the new write tools (`app_act`, `run_workflow`, `create_workflow` when it turns a workflow on, `http` actions) | all | unchanged |
| allow_all | `{}`, **except** `turn_on_computer` (it costs computer minutes: keep asking) and `sandbox_delete` (destroys data: keep asking). The user said "won't ask anything"; these two stay as hard stops because they are irreversible or billed. Write this in the mode tooltip | all | one line: "Mode: Allow all. Act without asking; still never reveal secrets." |
| plan | `{}` (nothing runs that would need it) | **write and side-effect tools hidden** with a middleware like `createHideToolsMiddleware`: `write_file`, `edit_file`, `execute`, `computer`, `turn_on_computer`, `turn_off_computer`, `copy_to_computer`, `share_file`, `generate_image`, `sandbox_*` except list/read/search, `app_act`, `run_workflow`, `create_workflow`, `update_workflow`, `spawn_subagents`, `start_background_task`, `update_memory`. Read tools stay (web search, `read_document`, `app_read`, `app_find_actions`, `list_my_workflows`) | a Plan section: "Investigate with read-only tools, then reply with a numbered plan (what you will do, which apps or workflows, what it changes). When the plan is ready and needs actions, call `request_mode_switch`." |

**Defence in depth:** hiding a tool is not enough (a model can hallucinate a tool call). Also add a `wrapToolCall` guard middleware that **refuses** any hidden tool name in Plan mode with the text "Plan mode: this action is not allowed. Call request_mode_switch." Add it to `stack.ts` via `extra`, and update `stack.check.ts`.

Sub-agents and background tasks inherit: in Plan mode they are not offered; in other modes they keep today's rules (read-only app tools only).

## 3. The in-chat "switch mode" button

Tool `request_mode_switch({ to: "ask" | "allow_all", reason: string(≤300) })`, offered **only in Plan mode**:
- It calls LangGraph `interrupt({ kind: "mode_switch", to, reason, plan: <last assistant text, ≤2000> })`. Same mechanism as `ask_user` (`computer/tools/pause.ts`). `pauseFor` already publishes `run.waiting_input` with `kind`; extend `pauseFor`'s payload pass-through to include `to` and `reason`.
- Web: `Prompts` (`features/chat/components/chat-view/prompts.tsx`) gets a new `ModeSwitchItem` when `prompt.kind === "mode_switch"`. It shows the reason and two buttons: **"Switch to Ask & continue"** / **"Switch to Allow all & continue"** (the requested one is primary), plus "Stay in Plan".
- Clicking a switch button:
  1. `PUT /threads/:id/mode {mode}`;
  2. updates the prompt-bar state;
  3. `resumeRun(runId, threadId, { answer: "switched:<mode>" })`.
- Server: on resume the slice re-reads the mode (a new slice starts after `waitForEvent`), so the next slice runs with the new tools. The tool returns "The user switched to <mode>. Carry out the plan now." Clicking "Stay" answers "stay", and the tool returns "The user kept Plan mode. Do not act; refine the plan if asked."
- Validate the answer server-side: the `resumeRunSchema` answer is free text, so the tool must only accept `switched:ask | switched:allow_all | stay`; anything else is treated as "stay". The real mode is whatever the DB says, never the answer text.

## 4. Prompt-bar picker (copy the effort menu, ≤100 lines per file)

Files in `features/chat/components/prompt-bar/`:
- `mode-menu.tsx`: a clone of `effort-menu.tsx` (gliding highlight, check mark, outside click). Three rows: icon, label and one-line description:
  - Allow all: "Acts without asking";
  - Plan: "Plans first, acts after you approve the plan";
  - Ask: "Asks before changing anything".
- `prompt-state.ts`: add `modeOpen`, `modeBox`, `modeHovered`, `modeMenuLeft`, `modeMenuBottom`, `modeRef`, `modeRowRefs`. This file is already long; put the mode state in a new `mode-state.ts` hook and merge it in `index.tsx`, so the 100-line rule holds.
- `composer-actions.tsx`: a mode button left of the effort button (icon: `ShieldCheck` = Ask, `ListChecks` = Plan, `Zap` = Allow all, plus a short label on wide layouts). It closes the other menus when opened, and opening the others closes it (update `closeMenus` and the outside-click effect in `prompt-effects2.ts`).
- Props: `mode`, `onModeChange` on `PromptBar` (`types.ts`, `index.tsx`), wired from `Prompts` → `ChatView` → `useChat` (`state.mode`, `setMode`, which calls the API optimistically and rolls back on error with a toast).
- `use-chat`: load the mode from the history response; handle the `thread.mode` event in the stream reducer (`reduce-event.ts`: a new case, add a check test).
- The textarea auto-resize effect measures `modelRef` for the inline width: include `modeRef`'s width too (`prompt-effects2.ts`).

## 5. Done when
- The mode persists per chat across reloads and tabs. Changing it while a run works applies from the next step.
- Ask: Gmail send shows an approval card. Allow all: it sends without a card. Plan: no send tool exists; the bot replies with a plan and a switch card appears; clicking "Switch to Ask & continue" flips the picker and the run continues and asks before sending.
- A forced hidden-tool call in Plan mode is refused by the guard middleware (`modes.check.ts` covers `approvalsFor` and the hidden list).
- Light and dark, keyboard (Esc closes the menu, arrows move through it); the picker doesn't break the composer layout at narrow widths.
