---
name: ai-elements
description: shadcn/ui AI Elements patterns for agentic interfaces (chat, messages, prompt input, reasoning, tools, traces) and the @shadcn/helpers/ai-sdk createChat helper. Use when building or extending AI chat UIs in this project.
---

# shadcn/ui AI Elements

Patterns for agentic interfaces, built from shadcn/ui components. **There is no
package to install** — each pattern is a composition of shadcn/ui components
copied into the project. The code is ours.

Install base components with the CLI ONLY (never hand-write component code):

```bash
npx shadcn@latest add <component>
```

A **Chat** is a list of **Message** turns inside a **Message Scroller**. Agent
steps (Reasoning, Tool, Plan…) are all built on **Trace**, so every step has the
same shape. Style family: `base` / base-ui (matches this project's
`@base-ui/react`).

## Component → pattern provenance map

Every `components/ui/*` file below was installed for AI Elements. Read the
pattern section here before changing any of them.

| Installed component    | Belongs to pattern(s)                                              |
| ---------------------- | ------------------------------------------------------------------ |
| `message-scroller.tsx` | Chat — the thread; keeps your place while replies stream           |
| `message.tsx`          | Message — one turn (user bubble / assistant reply + actions)       |
| `bubble.tsx`           | Message / Chat — the user's speech bubble                          |
| `input-group.tsx`      | Prompt Input (field + addons), Model Selector menus                |
| `tooltip.tsx`          | Message actions (copy/retry buttons)                               |
| `trace.tsx`            | Reasoning, Tool, Plan, Task, Queue, Sources, Terminal, Stack Trace, Test Results, Subagent, Chain of Thought |
| `code-block.tsx`       | Tool / Terminal / Stack Trace / Test Results output blocks         |
| `marker.tsx`           | Checkpoint — a restorable point in the conversation                |
| `item.tsx`             | Confirmation — approve/deny a tool before it runs                  |
| `hover-card.tsx`       | Context (usage %), Inline Citation                                 |
| `collapsible.tsx`      | File Tree                                                          |
| `dropdown-menu.tsx`    | Model Selector (model + effort menus)                              |
| `badge.tsx`            | Chain of Thought search results, Subagent details                  |

Docs pages are `https://ui.shadcn.com/docs/ai-elements/base/<pattern>.md`
(append `.md` for markdown).

## The patterns (condensed reference)

### Chat — the thread

Built with: `message-scroller`, `message`, `bubble`, `input-group`.
Install: `npx shadcn@latest add message-scroller message bubble input-group`

```tsx
<MessageScrollerProvider autoScroll>
  <MessageScroller>
    <MessageScrollerViewport>
      <MessageScrollerContent>
        <MessageScrollerItem messageId={id} scrollAnchor>
          <Message align="end">
            <MessageContent>
              <Bubble align="end" variant="muted">
                <BubbleContent>{text}</BubbleContent>
              </Bubble>
            </MessageContent>
          </Message>
        </MessageScrollerItem>
      </MessageScrollerContent>
    </MessageScrollerViewport>
    <MessageScrollerButton />
  </MessageScroller>
</MessageScrollerProvider>
```

- `scrollAnchor` goes on the **person's** turn — a new question settles near the
  top and the reply streams in under it.
- `autoScroll` follows the reply while the person stays at the live edge.
- `MessageScrollerButton` = scroll-to-bottom button.

### Message — one turn

Built with: `message`, `bubble`, `tooltip`.

User turn: `Message align="end"` → `MessageContent` → `Bubble align="end" variant="muted"` → `BubbleContent`.
Assistant turn: `Message` → `MessageContent` (text/markdown) + `MessageFooter`
with ghost `icon-sm` action buttons in a Tooltip (copy w/ 2s check swap,
good/bad toggles with `aria-pressed`, retry, edit).
Render streamed markdown with Streamdown; route fenced code to Code Block.

### Prompt Input — the field

Built with: `input-group`, `attachment`, `dropdown-menu`.

```tsx
<form ref={formRef} onSubmit={onSubmit}>
  <InputGroup>
    <InputGroupTextarea value={text} onChange={...} className="p-3" placeholder="..." />
    <InputGroupAddon align="block-end">
      <InputGroupButton size="icon-sm" variant="outline" className="rounded-full" aria-label="Attach files"><PlusIcon /></InputGroupButton>
      <InputGroupButton type="submit" size="icon-sm" variant="default" className="ml-auto rounded-full" disabled={!canSend} aria-label="Send"><ArrowUpIcon /></InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</form>
```

- Attachments render as Attachment chips in a `block-start` addon.
- Model Selector menus go in the `block-end` addon (move `ml-auto` to the first menu).
- Keyboard: Enter sends, Shift+Enter newline:
  `if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); formRef.current?.requestSubmit() }`

### Model Selector — two menus

Dropdown Menu inside InputGroupAddon: one radio menu for the model
(grouped by provider with `DropdownMenuLabel`), one for effort (low/medium/high).
Trigger: `render={<InputGroupButton size="sm" />}`, items `closeOnClick`.

### Trace-based patterns (all share one shape)

Base install: `npx shadcn@latest add trace` (+ `code-block` where output is shown, + `badge` for search results/subagent details).

Shared skeleton:

```tsx
<Trace>
  <TraceCollapsible defaultOpen?>          {/* or plain TraceLine while running */}
    <TraceCollapsibleTrigger>
      <TraceLine status={running ? "running" : failed ? "error" : undefined}>
        <TraceIcon><CircleCheckIcon /></TraceIcon>
        <TraceTitle>Researched in 3 steps</TraceTitle>
        <TraceDescription>optional detail</TraceDescription>
      </TraceLine>
    </TraceCollapsibleTrigger>
    <TraceCollapsibleContent keepMounted?>
      <Trace>{/* steps */}</Trace>
    </TraceCollapsibleContent>
  </TraceCollapsible>
</Trace>
```

- `TraceLine` status: `"running"` | `"pending"` | `"error"` | none (done).
- `keepMounted` keeps step open-state when the summary closes.
- Open-while-running, user override wins (controlled `open ?? running`).

Per-pattern notes:
- **Reasoning**: title "Thinking" while streaming → "Thought" (+ duration in TraceDescription); plain TraceLine until text arrives.
- **Chain of Thought**: summary "Researched in N steps" expands to steps; web-search results = `Badge variant="secondary"` per hostname.
- **Tool**: map AI SDK part states — `input-streaming`/`input-available` → running "Running …" (error if chat stopped); `output-available` → "Ran …"; `output-error` → error "Failed to run …"; `output-denied` → "Denied …". Output in CodeBlock `size="sm"` `wrap` `max-h-64`. Long output → wrap line in SheetTrigger.
- **Plan**: steps known up front; title counts done ("2 of 5 done"); pending steps exist.
- **Task**: steps appear as taken; no pending; title present→past tense; one Trace may hold several tasks, keep running one open.
- **Queue**: two sections (To do / Completed) as two TraceCollapsibles; todos with descriptions are collapsible, without are plain lines; `in_progress` gets `"running"` only while chat streams.
- **Sources**: "Used N sources" expands to links (dedupe by url); each link wraps a TraceLine, `sr-only` "(opens in a new tab)".
- **Terminal**: command line + streaming output in CodeBlock; non-zero exit → status="error", title "… exited with code 1".
- **Stack Trace**: status="error" title "Failed: TypeError…"; frames in muted monospace block; node_modules frames dimmed; only send stacks in dev.
- **Test Results**: summary counts pass/fail; suites collapsible (open when failed); failures show error CodeBlock.
- **Subagent**: line per subagent run; content = nested Trace of its tool calls + result; `preliminary: true` outputs still "Running …".

### Confirmation — approve/deny

`Item variant="outline" size="sm"` with `ItemMedia icon` + `ItemContent/ItemTitle`
("Run <cmd>?") + `ItemActions` (Deny outline / Approve default, both `size="sm"`).
Sits OUTSIDE Trace (a question, not a step). After answering it becomes a Tool line.
`useChat({ sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses })`.

### Checkpoint — restorable point

`Marker variant="separator"` + `MarkerContent` (label + `Button size="xs" variant="outline"` "Restore").
Restore = keep messages up to & including that turn: `setMessages(messages.slice(0, index + 1))`.

### Context — usage %

HoverCard trigger `Button variant="outline" size="sm"` showing "{percent}% context",
content w-64 with used/limit + `Progress value={percent}`.

### Inline Citation

HoverCard; trigger `Button variant="secondary" size="xs"` with hostname;
content shows title + link (new tab).

### File Tree

Folders = `Collapsible defaultOpen` with `CollapsibleTrigger render={<Button variant="ghost" size="sm" className="w-full justify-start" />}`
(chevron rotates via `group-data-panel-open/button:rotate-90`); files = Buttons calling `onSelect(path)`.

### Suggestion — one-click prompts

Row of `Button variant="outline" size="sm" className="shrink-0"` in
`flex scroll-fade-x scrollbar-none gap-2 overflow-x-auto overscroll-x-contain`;
onClick sends the label as the message.

### Chatbot template

For a full chatbot: https://github.com/shadcn-ui/chatbot-template (Next.js + AI SDK + shadcn/ui).

## AI SDK helper — `@shadcn/helpers/ai-sdk`

Script an AI conversation in code and stream it through the REAL `useChat`
lifecycle — no model, no API route, no network, no key. Use it to build/preview
the UI before a backend exists.

```bash
npm install @shadcn/helpers   # alongside ai + @ai-sdk/react
```

```ts
import { createChat } from "@shadcn/helpers/ai-sdk";

const chat = createChat()
  .user("Add a dark mode toggle to the settings page.")
  .assistant(({ writer }) => {
    writer.reasoning("I need to know how themes are set up first.");
    writer.tool("runCommand", { input: { command: "rg -l ThemeProvider app" } })
      .output({ stdout: "app/layout.tsx" });
    writer.text("next-themes is already set up, so I added a ModeToggle.");
  });

const { messages, sendMessage } = useChat({
  messages: chat.get(0),          // empty start; chat.get(2) = first two messages
  transport: chat.transport({ delayMs: 50, fallback: "This demo only knows the scripted turns." }),
});
const nextMessage = chat.next(messages); // next scripted user message | null
```

Writer methods: `text`, `reasoning`, `tool(name, opts)` (→ handle with
`sleep(ms)`, `output(value, { preliminary? })`, `error(err?)`, `denied()`),
`data({ type, id, data, transient? })` (same type+id updates in place),
`file`, `reasoningFile`, `sourceUrl`, `sourceDocument`, `stepStart`, `custom`,
`sleep`, `error`. Options: `{ id, delayMs, mode: "stream" | "instant" }`.
`chat.sleep(ms)` between turns; `needsApproval: true` pauses for approval;
unresolved tool input pauses the turn (client supplies output via
`addToolOutput`); continuations are callbacks after a paused turn receiving
`{ writer, toolCall, toolCalls, messages }`.
Type it: `createChat<ChatMessage>()` where
`ChatMessage = UIMessage<Metadata, DataParts, Tools>` — same type param as `useChat`.

## Migrating from (old) AI SDK Elements

Old wrapper → new base: conversation→Chat/message-scroller, message→Message+Bubble,
prompt-input→InputGroup+Attachment, agent→Subagent (Trace), chain-of-thought→Trace+Badge,
checkpoint→Marker+Button, confirmation→Item+Button, context→HoverCard+Progress,
file-tree→Collapsible+Button, inline-citation→HoverCard+Button, model-selector→DropdownMenu,
plan/queue/reasoning/sources/task/terminal/test-results/tool/stack-trace→Trace(+CodeBlock),
shimmer→shimmer util, question→Questionnaire.
Elements with no replacement (artifact, audio-player, canvas/node/edge…, env-vars,
image, jsx-preview, mic/voice-selector, open-in-chat, package-info, persona,
sandbox, schema-display, snippet, speech-input, transcription, web-preview) are
small compositions — build from Card/Button/Tooltip/Item/Badge/etc. as listed in
the official docs.
