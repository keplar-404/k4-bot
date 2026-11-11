# LangChain JS v1 / Deep Agents (TS): Middleware, Memory, Structured Output, HITL

Sources: the docs pages below; installed type definitions at `node_modules/.bun/langchain@1.6.3+.../dist/agents/middleware/*.d.ts` (cited as [langchain 1.6.3 d.ts]) and `deepagents@1.16.3` `dist/index.d.ts` (cited as [deepagents 1.16.3 d.ts]); and the local skills in `.agents/skills/*`.

## 1. Prebuilt middleware in LangChain JS v1

### Takeaway
langchain 1.6.3 ships about 22 prebuilt middleware, exported from `langchain`. For a weak or free model, the most useful set is modelRetry + modelFallback + toolRetry/toolError + modelCallLimit/toolCallLimit + todoList, plus summarization or contextEditing for long threads. HITL and the thread-level limits need a checkpointer.

### Cited Findings
- Full export list in 1.6.3: humanInTheLoopMiddleware, summarizationMiddleware, dynamicSystemPromptMiddleware, llmToolSelectorMiddleware, piiMiddleware, piiRedactionMiddleware, contextEditingMiddleware (ClearToolUsesEdit), toolCallLimitMiddleware, todoListMiddleware, modelCallLimitMiddleware, modelFallbackMiddleware, modelRetryMiddleware, toolRetryMiddleware, toolErrorMiddleware, toolEmulatorMiddleware, providerToolSearchMiddleware, openAIModerationMiddleware, anthropicPromptCachingMiddleware, bedrockPromptCachingMiddleware, openAIAutoModeMiddleware, openAIModelRouterMiddleware, plus the helper countTokensApproximately — [langchain 1.6.3 d.ts, middleware/index.d.ts]
- `modelRefusalMiddleware` needs langchain >= 1.6.4, so it is **not in the installed 1.6.3**. It throws `ModelRefusalError` on `refusal` content blocks only, not on refusals written as plain text — [Built-in middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- **toolRetryMiddleware** options: `tools`, `maxRetries` (default 2), `retryOn` (error classes or a predicate), `onFailure` (`'continue'` default | `'error'` | function returning a string; `'raise'`/`'return_message'` are deprecated), `backoffFactor` 2, `initialDelayMs` 1000, `maxDelayMs` 60000, `jitter` true — [Built-in middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in); [langchain 1.6.3 d.ts toolRetry]
- **modelRetryMiddleware** takes the same options without `tools`. With the default `onFailure:'continue'`, it returns an AIMessage that contains the error. It does not retry refusals — [Built-in middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- **modelFallbackMiddleware(...models)** takes variadic model strings or instances (fallbacks only, not the primary), tried in order. Put it before modelRefusalMiddleware — [Built-in middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in); [langchain 1.6.3 d.ts modelFallback]
- **modelCallLimitMiddleware**: `threadLimit`, `runLimit`, `exitBehavior` (`'end'` default | `'error'`). It tracks `threadModelCallCount` and `runModelCallCount` in state — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in); [d.ts modelCallLimit]
- **toolCallLimitMiddleware**: `toolName?`, `threadLimit`, `runLimit` (at least one is required), `exitBehavior` (`'continue'` default | `'error'` | `'end'`). `'end'` only works when limiting a single tool. It exports `ToolCallLimitExceededError` — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in); [d.ts toolCallLimit]
- **toolErrorMiddleware** (1.6.x): `onError(error, request) => MessageContent | void` and optional `tools`. Handling is opt-in: returning void re-throws the error. Some errors (for example, interrupts) always propagate and never reach `onError` — [d.ts toolError]. This middleware is not listed on the built-in docs page.
- **summarizationMiddleware**: `model` (required), `trigger` ({fraction|tokens|messages}, or an array of them; **off unless set**), `keep` (default {messages:20}), `tokenCounter`, `summaryPrompt`, `trimTokensToSummarize` (4000), `summaryPrefix`. `maxTokensBeforeSummary`/`messagesToKeep` are deprecated. Fraction-based settings need model profile data (langchain 1.1.0). Multimodal content becomes text when summarized — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in); [d.ts summarization]
- **contextEditingMiddleware**: `edits` (default `[new ClearToolUsesEdit()]`) and `tokenCountMethod` ('approx'|'model'). ClearToolUsesEdit defaults: `triggerTokens` 100000, keep 3, `clearAtLeast` 0, `clearToolInputs` false, `excludeTools` [], `placeholder` "[cleared]". Newer options are `trigger`/`keep` as ContextSize — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in); [d.ts contextEditing]
- **todoListMiddleware**: options `systemPrompt` and `toolDescription`. It adds a `write_todos` tool and `todos` state (`content`, `status` pending|in_progress|completed) — [d.ts todoListMiddleware]
- **llmToolSelectorMiddleware**: `model`, `systemPrompt`, `maxTools`, `alwaysInclude`. Tools in `alwaysInclude` don't count toward `maxTools` — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- **providerToolSearchMiddleware**: `searchableTools`. Only Anthropic and OpenAI are supported; other providers throw — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- **piiMiddleware(piiType, {strategy: block|redact|mask|hash (default redact), detector, applyToInput true, applyToOutput false, applyToToolResults false})**. Built-in types: email, credit_card, ip, mac_address, url — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in); [d.ts pii]
- **toolEmulatorMiddleware** (`tools`, `model`) has the LLM fake tool results. It is for testing only — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- **dynamicSystemPromptMiddleware(fn)** builds the system prompt from state and runtime context on each call — [d.ts dynamicSystemPrompt]
- **anthropicPromptCachingMiddleware**: `enableCaching`, `ttl` ('5m'|'1h'), `minMessagesToCache`, `unsupportedModelBehavior` ('ignore'|'warn'|'raise'). A Bedrock equivalent also exists — [d.ts provider/anthropic/promptCaching]
- Ordering rules: fallback goes before refusal. modelRetry goes after refusal, or set `onFailure:"error"`. HITL and thread-level limits need a checkpointer. Text streamed before a refusal can still reach the client — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)

### Inferences
- A good order for an unreliable free model: `[modelCallLimit, modelFallback(...), modelRetry, toolRetry, toolError, todoList, summarization]`. Use `exitBehavior:'end'` on the limits so loops end cleanly instead of throwing.
- `toolError` with a handler that returns an error string to the model, plus toolRetry for transient errors, lets weak models correct their own bad tool arguments.

### Gaps
- I did not verify the exact wrap/compose order semantics, i.e. whether the first middleware in the array is the outermost wrapper.
- The docs page does not cover toolErrorMiddleware or the OpenAI autoMode/modelRouter middleware. Their options come only from the d.ts files.

## 2. Deep Agents (JS) built-ins; createDeepAgent vs createAgent

### Takeaway
deepagents 1.16.3 `createDeepAgent` wraps `createAgent` and preloads planning (todos), a filesystem with pluggable backends, subagents (`task` tool), summarization, and patched tool calls. Choose it when the assistant needs multi-step planning, scratch files, or delegation. A focused workflow-builder assistant with a fixed toolset fits plain `createAgent` plus selected middleware.

### Cited Findings
- `CreateDeepAgentParams` fields: `model`, `tools`, `systemPrompt`, `stateSchema`, `middleware`, `subagents`, `responseFormat`, `contextSchema`, `checkpointer`, `store`, `backend` (instance or factory of state/store), `interruptOn`. The page also shows `memory` and `skills` — [deepagents 1.16.3 d.ts]; [Long-term memory](https://docs.langchain.com/oss/javascript/deepagents/long-term-memory)
- Exported middleware and backends include: createFilesystemMiddleware, createSubAgentMiddleware, createAsyncSubAgentMiddleware, createSkillsMiddleware, createMemoryMiddleware, createAgentMemoryMiddleware, createSummarizationMiddleware, createPatchToolCallsMiddleware, createUnsupportedContentMiddleware, createCompletionCallbackMiddleware; StateBackend, StoreBackend, CompositeBackend, FilesystemBackend, LocalShellBackend, ContextHubBackend, LangSmithSandbox — [deepagents 1.16.3 d.ts]
- FilesystemMiddleware provides `ls`, `read_file`, `write_file`, and `edit_file`, plus glob and grep. `backend` defaults to StateBackend. The subagent middleware adds a `task` tool, and a `general-purpose` subagent is always available. In a Deep Agent, add middleware through its own API rather than through createAgent — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- CompositeBackend: `new CompositeBackend(new StateBackend(), {"/memories/": new StoreBackend({namespace: rt => [...]})})`. Store keys are relative to the backend, because the route prefix is stripped — [Long-term memory](https://docs.langchain.com/oss/javascript/deepagents/long-term-memory)
- `interruptOn` maps a tool name to `true` or `{allowedDecisions, description, argsSchema, when}`. Decisions: approve | edit | reject | respond — [langchain 1.6.3 d.ts hitl]
- The local skill `deep-agents-orchestration` covers SubAgentMiddleware, TodoList, and HITL interrupts. `deep-agents-memory` advises PostgresStore in production, because InMemoryStore is lost on restart — local `.agents/skills/deep-agents-memory/SKILL.md` (lines ~284-296)

### Inferences
- In a workflow builder, the graph JSON is the "file". Exposing it through custom tools (get_graph, patch_graph, validate) is usually cleaner than putting a virtual filesystem in front of the model.

### Gaps
- I found no official JS page that compares createDeepAgent and createAgent directly. The recommendation above is my own inference.

## 3. Long-term vs short-term memory and Postgres persistence

### Takeaway
Short-term memory is the checkpointer keyed by `thread_id`. Long-term memory is a LangGraph `BaseStore` with tuple namespaces (for example `[userId, "memories"]`). Postgres provides both through `@langchain/langgraph-checkpoint-postgres`.

### Cited Findings
- Namespace patterns: agent-scoped `rt => [rt.serverInfo.assistantId]`, user-scoped `rt => [rt.serverInfo.user.identity]`, org-scoped `rt => [rt.context.orgId]`. `rt.serverInfo` needs deepagents >= 1.9.0 — [Long-term memory](https://docs.langchain.com/oss/javascript/deepagents/long-term-memory)
- Seed the store with `store.put(namespace, "/AGENTS.md", createFileData(...))` — [Long-term memory](https://docs.langchain.com/oss/javascript/deepagents/long-term-memory)
- The local `langgraph-persistence` skill covers checkpointers, thread_id, time travel, Store, and subgraph checkpointer scoping. The local `langgraph-human-in-the-loop` skill says to use PostgresSaver in production — `.agents/skills/langgraph-persistence/SKILL.md`, `.agents/skills/langgraph-human-in-the-loop/SKILL.md:21`
- Installed: @langchain/langgraph 1.6.0 and 1.7.2, @langchain/langgraph-checkpoint 1.2.2. I found no langgraph-checkpoint-postgres package in node_modules — local `node_modules/.bun` listing

### Inferences
- This backend runs on Cloudflare Workers (wrangler.jsonc). The `pg`-based PostgresSaver may need a TCP socket or Hyperdrive. As an alternative, a custom BaseCheckpointSaver/BaseStore could be built on the existing Drizzle DB.

### Gaps
- I did not fetch the JS PostgresSaver/PostgresStore API page. The skill file mentions `new PostgresStore({connectionString})`, but I did not verify the exact constructor or the need for `.setup()`.
- I did not verify Workers compatibility of the Postgres checkpointer.

## 4. Structured output (responseFormat / toolStrategy / providerStrategy)

### Takeaway
Pass `responseFormat` as a bare schema (the agent picks the provider strategy when the model profile supports it, otherwise tool calling), as `providerStrategy(schema)`, or as `toolStrategy(schema, {handleError, toolMessageContent})`. Zod `.transform()` cannot be converted to JSON Schema, so schemas sent to the model must be plain shapes.

### Cited Findings
- The result appears in `structuredResponse`. Native support is read from the model profile (langchain >= 1.1); set `structuredOutput: true` in a custom profile if it is missing. If tools are also passed, the model must support tools and structured output together — [Structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- toolStrategy `handleError`: `true` (default, retry with the default message), `false` (exceptions propagate), a string, or a function `(ToolStrategyError) => string`. Multiple structured-output tool calls or validation failures cause a retry. toolStrategy accepts an array of schemas to express a union — [Structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- Refusals: providerStrategy throws `StructuredOutputParsingError`, while toolStrategy ends with no `structuredResponse` — [Structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- **Confirmed locally:** the installed zod 4.6.7 core contains the error "Transforms cannot be represented in JSON Schema". Converting a schema with `.transform()` throws (unless unrepresentable types are set to "any") — local `node_modules/.bun/zod@4.6.7/.../v4/core` (grep)

### Inferences
- `z.preprocess` and `.pipe(transform)` fail for the same reason. Keep the tool/response schema pure (object, string, enum, optional/nullable, describe), then normalize or coerce inside the tool body or after parsing.
- On weak models, a retry loop on toolStrategy can burn calls. Pair it with modelCallLimit.

### Gaps
- The docs page does not say whether langchain sets `unrepresentable:"any"` itself, so the conversion might silently drop transforms instead of throwing. I did not test this.

## 5. Human-in-the-loop: interrupt() in tools vs HITL middleware

### Takeaway
humanInTheLoopMiddleware is declarative approval of tool calls (approve/edit/reject/respond) through `interruptOn`. Calling `interrupt(payload)` inside a tool or node gives custom questions, such as asking the user to choose. Both resume with `new Command({resume})` on the same `thread_id` and need a checkpointer.

### Cited Findings
- HITL config: `interruptOn: Record<tool, boolean | {allowedDecisions, description (string|fn), argsSchema, when}>` and `descriptionPrefix`. The resume payload is `{decisions: [{type:"approve"}|{type:"edit", editedAction:{name,args}}|{type:"reject", message?}|{type:"respond", message}]}`. `isToolApprovalInterrupt` helps detect these interrupts. The `interruptMode` option is present in 1.6.3 — [langchain 1.6.3 d.ts hitl]
- By default it pauses once per model turn. `interruptMode: "per_call"` pauses for each tool call — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- On resume, the node restarts from the beginning, so all code before `interrupt()` re-runs. Payloads must be JSON-serializable. Use upserts and place side effects after `interrupt()`. Parallel interrupts can be resumed with a map of interrupt id to value — local `.agents/skills/langgraph-human-in-the-loop/SKILL.md` lines 23-31, 259, 366-373
- Tool errors that are interrupts always propagate past toolErrorMiddleware — [d.ts toolError]

### Inferences
- For "apply these changes to the workflow?" use HITL middleware on the mutating tools. For "which channel do you mean?" use `interrupt()` inside an `ask_user` tool, and keep the tool idempotent before the interrupt.

### Gaps
- I did not verify how interrupts surface in streamed output for this app's SSE transport.

## 6. Weak/free models and tool calling

### Takeaway
Weak models commonly loop, send malformed arguments, or skip tool calls. The prebuilt mitigations are retries, fallback, call limits, error-to-message conversion, todo reminders, and fewer tools (llmToolSelector).

### Cited Findings
- Chat model integrations mark auth and context-overflow errors as non-retryable, and the retry middleware respects those marks — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- `modelRetry onFailure:'continue'` puts the error into the conversation as an AIMessage, which a weak model may echo to the user — [Built-in](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
- deepagents exports `createPatchToolCallsMiddleware`, which repairs dangling or invalid tool calls in history (purpose inferred from its name). It is part of `REQUIRED_MIDDLEWARE_NAMES` — [deepagents 1.16.3 d.ts]

### Inferences
- Use llmToolSelector or a small toolset to reduce wrong-tool errors. Use toolStrategy with an explicit `handleError` string for clearer correction prompts.

### Gaps
- I found no official benchmarks on free-model tool-call reliability. The patch-tool-calls behaviour was not verified from source.
