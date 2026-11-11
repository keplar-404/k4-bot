# 05 — Workflow Assistant: chat panel UI

> **Status: DONE** — **Changed 2026-11-11 (product owner): the to-do list is gone; the chat streams the turn like `/chat/[id]`.**
> The assistant run reads its events through the chat’s own `consumeRun` (`agent/run-stream`) and keeps the same `Part[]`
> (reasoning, tool calls, text) on `assistant_run.parts` (migration 0027), pushes the growing turn over the builder socket
> (`assistant.parts`, ≤ every 250 ms, `assistant/live-parts.ts`), and saves it on `assistant_message.parts`. The panel renders
> it with the chat’s `AgentParts` (live: `streaming`; saved: folded work row + answer). `progress-row.tsx` was deleted.
> Decision 5 in the README (“no raw tool stream”) is superseded by this. (2026-11-11) — code in `apps/web/src/features/workflows/assistant/`
> - Done: Ask button (Sparkles, Ctrl/Cmd+I, working dot); floating panel 380×560, draggable by grip (pointer + arrow keys,
>   double-click resets, remembered in localStorage); header with History / New chat / Close; history across workflows
>   (paged, delete); messages with markdown; collapsible progress row (✓ / spinner / ○) — never tool calls; confirmation
>   and connect-apps cards (connect opens in a new tab); composer with model picker, image/text uploads (`uploadFile`),
>   Send / Stop; thread remembered across pages; Esc closes.
> - Done (follow-up): rename a chat by clicking its title (`assistant/thread-title.tsx`); Ctrl/Cmd+I in the shortcuts dialog.
> - Changed: the answer appears when the turn ends (not token by token); the to-do list is what updates live.

A small chat window on the builder page, like a website chat widget. shadcn/ui components only (already installed:
`button, card, dialog, dropdown-menu, input-group, popover, select, sheet, skeleton, textarea, tooltip, collapsible,
scroll / message-scroller, message, bubble, item, kbd`; check `apps/web/src/components/ui/`). Add missing ones with
`bunx shadcn add <name>` (use the `shadcn` skill); never hand-edit `components/ui/*`.

Module: `apps/web/src/features/workflows/assistant/` (only used by the builder).

## 1. Entry point

- [ ] Top bar button **Ask** with lucide `SparklesIcon`, in `workflow-builder.tsx` top bar children next to the
      JSON button (`top-bar/json-sheet.tsx`). Keyboard shortcut `Ctrl/Cmd + I` (add to `use-shortcuts.ts` and the
      shortcuts dialog).
- [ ] Badge/dot on the button while a run is active (any thread).

## 2. Panel

- [ ] Floating panel, default docked bottom-right of the canvas area, ~380 × 560 px, `rounded-xl border bg-card
      shadow-lg` (match the builder's floating panels: `settings/settings-panel.tsx` `PANEL`).
- [ ] **Draggable** by a grip handle in the header (lucide `GripVerticalIcon`): pointer events, clamp inside the
      viewport, remember position in localStorage with try/catch (copy `panels-store.ts` `safeStorage`). No new drag
      library. Double-click the grip → reset to default position.
- [ ] Header: grip · title (thread title or "New chat") · History button (`HistoryIcon`) · New chat (`PlusIcon` /
      `SquarePenIcon`) · close (`XIcon`).
- [ ] History view (replaces the message list, back arrow to return): threads newest first, each with title, the
      workflow name it was about, relative time; rename / delete in a `DropdownMenu`. Infinite scroll with the cursor
      from `GET /assistant/threads`.
- [ ] Message list: user bubbles right, assistant left (reuse `components/ui/message` / `bubble` if they fit),
      markdown for assistant answers (`components/markdown`). Auto-scroll with the existing `message-scroller`.
- [ ] Composer (`InputGroup` + `Textarea` autosize): placeholder `e.g. Every morning at 8, email me a summary of new
      Stripe payments`, model picker (`Select`, models from `GET /api/v1/models`, default from the thread or
      `DEFAULT_MODEL_ID`; remembered per user in localStorage), attach button (`PaperclipIcon`) for images + text
      files, Send (Enter), Shift+Enter newline, Stop while running.
- [ ] Attachments: reuse `features/chat/hooks/use-attachments.ts` (upload on pick, chips with remove, errors as
      toasts). Accept `image/*,.pdf,.txt,.md,.csv,.json`.
- [ ] Empty state: 3 example prompts as buttons (fill the composer):
      - "Fetch my last 10 Gmail emails and summarise each one"
      - "When a Stripe payment fails, post it to Slack #billing"
      - "Fix the issues on this workflow"

## 3. Progress view (the only "work" the user sees)

Exactly this shape, one per assistant turn:

```
▾ Building "Gmail digest"                 ← Collapsible; title = first todo or "Working…"; ▸ when collapsed
    ✅ Added Gmail block
    ✅ Set Fetch emails to 10 results
    ⟳ Adding Code block…                  ← Loader2Icon animate-spin for in_progress
    ○ Test the workflow                   ← CircleIcon muted for pending
Final answer markdown here
```

- [ ] Data: `todos` events from the relay (doc 02) and `assistant_message.todos` for finished turns.
- [ ] Open while running, auto-collapse when the run finishes (user can expand).
- [ ] Reuse styling ideas from `features/chat/components/agent-parts/todo-list.tsx`, but **never** render tool
      calls, arguments, reasoning, or raw events.
- [ ] Final answer streams in (`answer.token`), then is replaced by the saved message on `run.finished`.
- [ ] Failure: red line "Stopped: <reason>" with a Retry button (resends the last user message).
- [ ] Connect apps request (from `request_app_connections` interrupt): a card with app logos (`AppLogo`) and
      Connect buttons (reuse `features/connect` `authorizeApp`; return URL = this builder page with `?assistant=1` so
      the panel reopens). After connecting, the panel posts the resume (same pattern as chat's resume:
      `features/chat/hooks/use-chat/resume.ts`).
- [ ] Turn-on confirmation (interrupt): card "Turn on <name>?" with Turn on / Not now.

## 4. State and sync

- [ ] Zustand store `assistant/store.ts`: `open`, `position`, `view: "chat" | "history"`, `threadId`, `messages`,
      `activeRun { id, todos, answer, status }`.
- [ ] On open: `GET /assistant/threads/:id` (latest thread if none) → messages + active run; then connect the relay
      socket (`POST /assistant/live-token`) and resume from the last `seq`; on a gap, refetch the thread.
- [ ] Panel open state + thread id survive navigation between workflows (store is module-level; persist `threadId`
      in localStorage).
- [ ] Sending from workflow B in a thread that was about workflow A: send `workflowId = current page`; the backend
      updates the thread's workflow.

## 5. Accessibility

- [ ] Panel is a `role="dialog"` with `aria-label="Workflow assistant"`, not modal; Esc closes; focus moves to the
      composer on open and back to the Ask button on close.
- [ ] Progress list is an `aria-live="polite"` region; status icons have text labels for screen readers.
- [ ] Drag handle also movable with arrow keys (10 px steps).

## Acceptance

- [ ] Panel opens/closes, drags, remembers position, works in light and dark themes.
- [ ] History lists threads across workflows; opening one restores messages and a live run if any.
- [ ] Image upload → the model sees it (ask "what's in this screenshot?").
- [ ] During a run only the progress list and answer are shown; no tool names anywhere in the DOM.
