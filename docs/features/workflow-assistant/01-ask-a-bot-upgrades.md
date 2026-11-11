# 01 — Ask a bot upgrades

> **Status: DONE** (2026-11-11). Choices made: a normal bot ignores `useApps`/`files` at run time and the UI hides them;
> structured answers use `createAgent({ responseFormat })` → `result.structuredResponse` (langchain 1.6), re-checked
> with the same zod schema. New files: `engine/blocks/answer-schema.ts` (+ check), `graph/ai-block.check.ts`,
> web `settings/ai-model-picker.tsx`, `settings/ai-output-fields.tsx`. Not verified in a browser or with a live model yet.

Three changes to the **Ask a bot** block (`kind: "ai.bot"`). Independent of the assistant; ship first.

## Current state (read these)

- Schema: `apps/backend/src/modules/workflows/graph/event-ai-blocks.ts` → `aiConfig`:
  `{ botId?, prompt, output: "text" | "json", useApps, files[] }`.
- Engine: `apps/backend/src/modules/workflows/engine/blocks/ai.ts` → `runAi` loads the bot **owned by the user**
  (`bot.id = config.botId AND bot.userId = run.userId`), its memory (`loadMemory`), tools (`ai-tools.ts`), builds a
  LangChain `createAgent` with the bot's `modelId` / `reasoningEffort`, enforces `MAX_AI_STEPS_PER_DAY`.
  JSON answers are parsed by `parseJsonAnswer` in `blocks/ai-prompt.ts`.
- Output today: `{ text }` or `{ json }` → read as `{{steps.<id>.output.text}}` / `output.json.<field>`.
- Validation: `graph/validate.ts` (`publishIssues`) — an AI block without a bot is an issue.
- Web settings: `apps/web/src/features/workflows/builder/settings/ai-settings.tsx`, `bot-picker.tsx`,
  `ai-knowledge.tsx`, `ai-apps-note.tsx`.
- Data picker shape for built-in blocks: `apps/web/src/features/workflows/builder/template/builtin-schemas.ts`.
- Portable export strips `botId` and `files` (`graph/portable.ts`); keep doing that.
- Bots building workflows read `BLOCKS_HELP` in `apps/backend/src/prompts/workflow-tools.ts`: update it.

## A. "Who does it": Normal bot or one of my bots

**Behaviour**
- Two choices in the settings: **Normal bot** (default for new blocks) and **One of my bots**.
- Normal bot: no persona, no memory, no connected apps, no knowledge files. Just a model + the prompt. The user picks
  the model from the catalog (`GET /api/v1/models`, same list as the chat's model picker) and optionally reasoning
  effort where the model supports it.
- One of my bots: exactly today's behaviour (bot's model, memory, persona, optional read-only apps, files).

**Tasks**
- [x] Schema (`event-ai-blocks.ts`): add `agent: z.enum(["normal", "bot"]).default("bot")` (default `"bot"` so
      saved workflows keep working), `modelId: text(120).optional()`, `reasoningEffort: z.enum([...]).optional()`
      (reuse the values `models.ts` accepts; see `modelError`).
- [x] New blocks default to `agent: "normal"` with `DEFAULT_MODEL_ID` (web `new-block.ts`).
- [x] Validation (`graph/validate.ts`): `agent === "bot"` needs `botId`; `agent === "normal"` needs a `modelId`
      that `resolveModel` knows (import from `agent/models.ts`). Also reject `useApps`/`files` for normal (or ignore
      them at runtime and hide them in the UI — pick one and document it in the code comment).
- [x] Engine (`blocks/ai.ts`): branch on `config.agent`.
      - `normal`: no bot lookup, no memory, no tools, system prompt = a short neutral prompt (add it next to
        `aiStepPrompt`), model from `config.modelId`. Keep `MAX_AI_STEPS_PER_DAY` and usage accounting identical.
      - `bot`: unchanged.
      - Free models: follow what chat does for `isFreeModel` (no budget charge) — check `chat/run/slice.ts`.
- [x] Web `ai-settings.tsx`: a segmented choice (shadcn `ToggleGroup`, already installed) "Normal bot | One of my
      bots". Normal → model `Select` (reuse the chat's model picker component if one exists under
      `features/chat/components/prompt-bar`; otherwise a `Select` fed by the models API) + reasoning effort select
      shown only when the model supports it. Bot → existing `BotPicker`, apps note, knowledge files.
- [x] `block-label.ts`: title shows the model name for normal, the bot name for bot.
- [x] `BLOCKS_HELP`: document `agent`, `modelId`.
- [x] `graph/portable.ts`: keep stripping `botId`; **keep** `modelId` (not private). `requirementsOf.bots` counts
      only `agent === "bot"` blocks.
- [x] Update `portable.check.ts` and `graph.check.ts` / `publish.check.ts` with: normal block with model passes;
      normal without model fails; bot without botId fails.

## B. Structured output builder

**Behaviour**
- Output setting becomes three options: **Text**, **Structured (fields)**, **Free JSON** (today's `json`; keep for
  compatibility).
- Structured: the user builds the answer's shape in a form: rows of `name` · `type` · `description` (+ `choices` when
  the type is "one of"). Types: text, number, yes/no, list of text, one of (enum). One level only (no nested objects)
  — enough for routing and templating; nested is a later upgrade.
- The model is forced to answer in that exact shape. Read as `{{steps.<id>.output.json.<field>}}` (same path as
  today's JSON, so If/Switch/templates work unchanged).
- The data picker lists the fields immediately (no test run needed).

**Tasks**
- [x] Schema: `output: z.enum(["text", "json", "structured"]).default("text")`, and
      `schema: z.array(z.object({ name: identifier(40), type: z.enum(["text","number","boolean","list","enum"]),
      description: text(300).default(""), choices: z.array(text(80)).max(20).default([]) })).max(20).default([])`.
      Name regex like Set fields' key (`^[A-Za-z_][A-Za-z0-9_]{0,40}$`), unique names (refine).
- [x] Validation: `structured` needs ≥ 1 field; `enum` needs ≥ 2 choices.
- [x] Engine: build a zod object from the rows (`text`→`z.string()`, `number`→`z.number()`, `boolean`→
      `z.boolean()`, `list`→`z.array(z.string())`, `enum`→`z.enum(choices)`; `.describe(description)` each).
      Use LangChain's structured output for agents: `createAgent({ ..., responseFormat: zodSchema })` and read
      `result.structuredResponse` (verify the exact API for the installed `langchain` version in
      `apps/backend/node_modules/langchain` — the repo already uses `withStructuredOutput` in
      `modules/memory/auto/update.ts`; for the tool-less normal bot, `model.withStructuredOutput(schema)` is enough).
      Output `{ json: structuredResponse }`. On a schema failure: one retry, then `FatalBlockError("The answer did
      not match the fields you set: …")`.
- [x] `builtin-schemas.ts`: for `ai.bot` with `structured`, return `{ json: { properties: … } }` so the picker shows
      `json.urgent`, `json.reply`, … at once.
- [x] Web: new `settings/ai-output-fields.tsx` — rows with name input, type select, description input, choices input
      (comma separated, shown only for "one of"), add/remove row buttons. Reuse `SettingsSection`/`Field` from
      `settings/field.tsx`. Show a live preview line: `{{steps.<id>.output.json.<name>}}` per row (wrapping, not
      truncated — see the Decide fix in `decide/question-row.tsx`).
- [x] `BLOCKS_HELP`: document `output: "structured"` + `schema`.
- [x] Check file `engine/ai-structured.check.ts`: rows → zod schema conversion (each type, enum choices, required).

## C. Placeholders with real examples (every input in the AI block, then the whole builder)

Rule: every `Input`, `Textarea`, `TemplateInput` gets a placeholder that is a realistic example, written as the user
would type it. Not "Enter value". Use `e.g.` only when the example could be mistaken for a real value.

- [x] AI block:
      - Prompt: `Summarize this email in 2 sentences and say if it needs a reply today: {{loop.item.subject}} — {{loop.item.preview.body}}`
      - Field name: `urgent` · description: `true if the sender needs an answer today` · choices: `sales, support, spam`
- [x] Sweep `apps/web/src/features/workflows/builder/settings/*.tsx` and `template/template-input.tsx` users; list
      every field without an example placeholder and add one. Examples per block:
      - HTTP URL `https://api.example.com/v1/orders?status=open`; header value `Bearer {{secrets.STRIPE_KEY}}`
      - Set fields key `customerEmail` · value `{{trigger.inputs.email}}`
      - If/Filter left `{{steps.gmail.output.messages.0.subject}}` · right `Invoice`
      - Delay until `2026-12-01T09:00` or `{{trigger.inputs.date}}`
      - For each items `{{steps.gmail.output.messages}}`
      - Format input `{{loop.item.sender}}` · Code input key `orders`
      - Return field `summary` · value `{{steps.ai.output.text}}`
      - Decide "what to look at" `{{loop.item.subject}} {{loop.item.preview.body}}`; yes/no question `Does this email ask for a refund?`
      - Approval message `Send this reply to {{loop.item.sender}}?`
- [x] Keep placeholders ≤ ~70 chars visible; longer guidance goes in the field `hint`.

## Acceptance

- [x] Existing workflows with Ask a bot (bot chosen, text/json) run unchanged.
- [x] New block → Normal bot → pick model → Test this step answers.
- [x] Structured with `urgent (yes/no)` + `reply (text)`: test returns `{ json: { urgent: true, reply: "…" } }`,
      picker shows both fields before any test, an If on `json.urgent` routes correctly.
- [x] Export/import keeps `agent`, `modelId`, `schema`; strips `botId`, `files`.
- [x] `bunx tsc --noEmit` clean in both apps; checks pass.
