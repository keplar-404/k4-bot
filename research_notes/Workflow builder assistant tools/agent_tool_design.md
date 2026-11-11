# Designing Tools for LLM Agents that Edit Workflow Graphs (Composio-scale catalogs)

## 1. What do Anthropic, OpenAI, LangChain, and others recommend for tool granularity, naming, descriptions, responses, and errors?

### Takeaway
Use a small set of purpose-built, non-overlapping tools with clear namespaced names, "new hire" descriptions, strict schemas, enums for closed sets, compact high-signal responses, and errors that say how to fix the call. Keep fewer than about 20 tools loaded at the start of a turn.

### Cited Findings
- Build a few purpose-built tools for high-impact workflows, not thin wrappers around each API endpoint. For example, one `schedule_event` replaces `list_users`, `list_events` and `create_event`. Overlapping tools distract agents. — [Anthropic, Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Namespace by service or resource (`asana_search`, `asana_projects_search`). Prefix and suffix schemes perform differently across models, so test both. — [Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Return high-signal fields (`name`, `file_type`) rather than `uuid` or `mime_type`. Offer a `response_format` enum (`concise`/`detailed`); in Anthropic's Slack example, concise responses used about a third of the tokens. — [Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Paginate, filter and truncate large responses with sensible defaults. Claude Code caps tool responses at 25,000 tokens. Truncated output should tell the agent how to run a narrower search. — [Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Errors should be actionable: say what went wrong and show a correctly formatted input, not opaque codes or tracebacks. — [Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Write descriptions as you would for a new hire. Use unambiguous parameter names (`user_id`, not `user`). Small edits to descriptions can produce large gains. — [Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)
- OpenAI's guidance:
  - Use enums and structured objects to make invalid states impossible.
  - Apply the "intern test".
  - Don't ask the model for arguments your code already knows.
  - Combine functions that always run in sequence.
  - Keep "fewer than 20 functions available at the start of a turn" as a soft guideline.
  - Always use strict mode.
  - Examples help, but may hurt reasoning models.
  
  — [OpenAI function calling guide](https://developers.openai.com/api/docs/guides/function-calling)
- Tool use examples (`input_examples`) raised accuracy on complex parameter handling from 72% to 90% in Anthropic's internal tests. The recommendation is 1–5 realistic examples per tool, and only where the schema leaves usage unclear. — [Anthropic, Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)
- Programmatic tool calling cut average tokens on complex research tasks from 43,588 to 27,297 (37%). Use it for 3+ dependent calls or large intermediate data. — [Anthropic, Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)
- n8n's AI Workflow Builder reportedly uses granular graph tools: `search_nodes`, `get_node_details`, `add_nodes`, `connect_nodes`, `update_node_parameters`, `remove_node`. It is described as built on LangGraph with Claude Sonnet 4. The analysis is third-party and its author is unknown. — [Glama-hosted analysis](https://glama.ai/mcp/servers/@czlonkowski/n8n-mcp/blob/a40f6a5077001fbfbdc7529663a4ebcba608f5e6/docs/local/N8N_AI_WORKFLOW_BUILDER_ANALYSIS.md)

### Inferences
- A suggested core toolset of about 8–12 tools, in namespaced groups:
  - Catalog: `catalog_search_apps`, `catalog_search_actions`, `catalog_get_action_schema`
  - Graph edits: `workflow_get`, `workflow_add_nodes`, `workflow_connect`, `workflow_update_node`, `workflow_remove`
  - Checks: `workflow_validate`, `workflow_test_run`
  
  This mirrors n8n's design and stays under OpenAI's 20-tool soft limit.
- Server-known values (workflow ID, version, user connections) should be injected, not supplied by the model.
- Tool results should show node labels and app names alongside IDs.

### Gaps
- I did not fetch LangChain's tool docs directly. Its guidance is likely similar, but no citation is included here.

## 2. How should the agent edit a structured document: full replace, JSON Patch, or granular operations? How should IDs, validation, and concurrency work?

### Takeaway
Use ID-addressed operations (add/update/remove node or edge) instead of array-index JSON Patch or full regeneration. Keep keys stable, validate the whole graph after every batch, and return errors the model can fix. Full replace should be a fallback only.

### Cited Findings
- JSON Whisperer (Duanis et al., Oct 2025):
  - RFC 6902 patch generation instead of full regeneration cut tokens by 31%, with edit quality "within 5% of full regeneration". Gains were largest for complex instructions and list edits.
  - LLMs often miss related updates and struggle with array index shifts.
  - The fix, EASE, converts arrays into dictionaries keyed by stable IDs.
  
  — [arXiv 2510.04717](https://arxiv.org/abs/2510.04717v1)
- Plain-text replacement on JSON/YAML produces invalid output (broken braces, lost structure). Structured, selector-based edits avoid this. — [web search summary of tooling vendor docs; e.g. Morph tools guide](https://docs.morphllm.com/guides/tools) (secondary)
- Codex CLI dropped its JSON function-style `apply_patch` in favor of freeform patch text (May 2026), because models naturally emit diff-like text. — [Codex CLI blog](https://codex.danielvaughan.com/2026/05/08/codex-cli-apply-patch-freeform-only-function-style-deletion/) (third-party blog)
- OpenRouter recommends validating tool arguments against the schema before executing them. It classifies failures as `InvalidJson`, `UnknownName` and `SchemaMismatch`, and recommends logging each category. — [OpenRouter blog](https://openrouter.ai/blog/insights/agent-frameworks-compared-tool-calling-schema-handling/)

### Inferences
- Store nodes and edges as maps keyed by server-assigned stable IDs, or let the model pass a short `ref` that the server maps to an ID, so no index arithmetic is needed.
- Validate after each mutating call and return `{ok, errors:[{node_id, field, message, fix_hint}], summary}`.
- Use a `base_version`/etag on mutating calls, injected by the server. Reject a stale version and return the fresh graph summary, so user canvas edits and agent edits don't clobber each other.
- Allow a batch `operations[]` array so a whole plan can be applied atomically.

### Gaps
- I found no published benchmark specific to node/edge workflow graphs, and no source on optimistic concurrency for agent tools specifically.

## 3. How should the agent work with a catalog of about 1,700 apps and thousands of actions?

### Takeaway
Use search, then load the schema, then call. Never load all action schemas. Return 3–10 ranked candidates with short descriptions, and fetch full schemas only for the chosen slugs.

### Cited Findings
- Anthropic tool search:
  - Selection accuracy degrades past 30–50 tools.
  - A 5-server setup used about 55k tokens; tool search cuts this by over 85%.
  - Defaults to 5 results; limit of 10,000 deferred tools.
  - Two variants: regex and BM25.
  - Keep the 3–5 most-used tools non-deferred.
  - Use consistent prefixes and keywords in descriptions.
  - Custom (for example embedding-based) search is supported via `tool_reference`.
  
  — [Claude docs, Tool search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
- Tool search raised MCP eval accuracy for Opus 4 from 49% to 74%, and for Opus 4.5 from 79.5% to 88.1%. Token overhead fell from about 77K to about 8.7K. — [Anthropic, Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)
- OpenAI recommends tool search / deferred loading for large tool sets, with short namespace descriptions and detail in each function. — [OpenAI](https://developers.openai.com/api/docs/guides/function-calling)
- Composio meta tools (per a web-search summary of the docs):
  - `COMPOSIO_SEARCH_TOOLS` discovers tools and returns connection status, an execution plan and a `session_id`.
  - `COMPOSIO_GET_TOOL_SCHEMAS` takes the required `tool_slugs` and returns input (optionally output) schemas.
  - Docs say to use only slugs returned by search and never invent one. Misses come back in `not_found`, with up to 3 `suggestions` each.
  - Preview docs say the meta tool schemas aren't guaranteed to stay backward compatible.
  
  — [Composio meta tools](https://docs.composio.dev/toolkits/meta-tools), [GET_TOOL_SCHEMAS](https://docs.composio.dev/reference/meta-tools/get_tool_schemas.md)

### Inferences
- Copy Composio's "not_found + suggestions" pattern in our own catalog tools.
- When an unknown slug is used, the validator should return the closest valid slugs.
- Search results should include app connection status, so the agent can tell the user to connect an app.

### Gaps
- I did not verify the Composio page text directly, and the exact field names may differ. Check them before coding.

## 4. Which JSON Schema features break across providers (OpenAI strict, Anthropic, Gemini via OpenRouter)?

### Takeaway
Target the lowest common denominator: an object root, flat objects, every field required with nullable for optional, string enums, and no `allOf`/`not`/`if`. Avoid records (`additionalProperties` maps), `$ref`/`$defs`, and complex `anyOf` if Gemini is in play. Zod transforms and refinements don't serialize at all.

### Cited Findings
- OpenAI strict mode:
  - Supported: `anyOf`, `$defs`/`$ref` (recursive allowed), `pattern`, some `format`s, min/max, `minItems`/`maxItems`.
  - Not supported: `allOf`, `not`, `if/then/else`, `dependent*`, or a root `anyOf`.
  - Requirements: every property listed in `required` (optional fields are a union with `null`), and `additionalProperties:false` on every object.
  - Limits: 5,000 properties, 10 nesting levels, 1,000 total enum values, 120k characters of names and enums.
  
  — [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- A schema one provider accepts can be rejected by a stricter one. The same model on different providers produces valid tool calls at different rates, so test the exact model and provider pair. — [OpenRouter blog](https://openrouter.ai/blog/insights/agent-frameworks-compared-tool-calling-schema-handling/)
- Gemini through OpenRouter degraded with `$defs`/`$ref`/`anyOf`-nullable schemas while working when called directly. — [pydantic-ai issue #3617](https://github.com/pydantic/pydantic-ai/issues/3617)
- Community reports say Gemini rejects `anyOf`, `oneOf`, `const`, `$ref` and `$defs`. Projects flatten these or strip null variants. — [opencode PR #12911](https://gh.hhj520.top/anomalyco/opencode/pull/12911) (mirror), [zeroclaw commit](https://git.hoyer.xyz/harald/zeroclaw/commit/e871c9550b24851f9d957a7c81ad822a686d19f0). These are community sources, not official docs.
- DeepSeek via OpenRouter rejected a strict-mode `anyOf` nullable union ("missing field `type`"). The fix was to retry without strict. — [patch](https://git.sigkill.computer/titaniumtown/nixos/src/commit/70b331a7db36ee80349e59c59cdc88225c299d08/patches/omp/0001-openai-completions-retry-without-strict-on-deepseek-openrouter.patch)

### Inferences
- Composio action input schemas are arbitrary JSON Schema. Don't make them tool parameters. Pass node config as a JSON-encoded string or a loose object, and validate it server-side against the fetched action schema.
- Prefer `type: ["string","null"]` over `anyOf` for nullables, and a flat `op` enum with optional fields over discriminated unions.

### Gaps
- I did not fetch Google's official Gemini function-declaration schema subset docs or Anthropic's strict tool use limits.

## 5. How can weak or free models be made reliable?

### Takeaway
Small models collapse on multi-turn tool use. Reduce what they must choose and produce: few tools, examples, server-injected IDs, plan then act, a validate-and-retry loop with precise errors, and capped steps.

### Cited Findings
- On BFCL (TinyLLM paper): Qwen3-4B scored 62.04% overall but 35.25% multi-turn. Qwen3-1.7B scored 16.88% multi-turn, Qwen3-0.6B 1.38%, and 1.1B models 0%. — [arXiv 2511.22138](https://arxiv.org/pdf/2511.22138)
- BFCL V4 weights agentic tasks at 40% and multi-turn at 30%. Epoch AI rates v4 "Flawed" because of false negatives. — [Gorilla blog](https://gorilla.cs.berkeley.edu/blogs/16_bfcl_v4_memory.html), [Epoch review](https://epoch.ai/benchmarks/berkeley-function-calling-leaderboard/review)
- Examples raise complex-parameter accuracy from 72% to 90%. — [Anthropic](https://www.anthropic.com/engineering/advanced-tool-use)
- Some models return tool calls as plain text, which can stall the loop silently. OpenRouter recommends capping loop steps, routing to providers with low tool-error rates (Auto Exacto) and normalizing tool calls. — [OpenRouter blog](https://openrouter.ai/blog/insights/agent-frameworks-compared-tool-calling-schema-handling/)
- Don't make the model supply known arguments, and combine sequential calls. — [OpenAI](https://developers.openai.com/api/docs/guides/function-calling)

### Inferences
- For free models, expose a reduced toolset, possibly one `workflow_apply_ops` tool plus search.
- Add a parser for text-format tool calls.
- On a schema error, return the error plus a valid example and allow 1–2 retries.
- Re-inject a short graph summary each turn as a reminder.

### Gaps
- I found no controlled study of plan/act separation for graph editing.

## 6. How should tools that call real external apps be kept safe?

### Takeaway
Treat every tool and app output as untrusted. Separate read actions from write actions, require approval before side-effecting test runs, and pass data between nodes through constrained schemas.

### Cited Findings
- Treat tool outputs as untrusted and pass them as user-level, not developer-level, content. Extract only validated fields. Use enums and fixed schemas between nodes to remove freeform channels for injected instructions (this reduces risk, it does not eliminate it). Keep MCP approvals on so users confirm operations. Use human approval nodes. — [OpenAI agent builder safety](https://developers.openai.com/api/docs/guides/agent-builder-safety)

### Inferences
- Tag each Composio action as read or write (by naming heuristic such as GET/LIST/SEARCH versus CREATE/SEND/DELETE, or by metadata).
- Building the graph never executes actions. A test run of a write action needs explicit user confirmation, or should use a dry-run with sample data.

### Gaps
- I found no source on Composio's own read/write classification metadata.

## 7. How should a workflow-building agent be evaluated?

### Takeaway
Start with 20–50 realistic tasks taken from real failures. Grade the final graph state with deterministic checks (valid, has the expected apps, triggers and edges), use an LLM judge for intent fit, and track pass^k for consistency.

### Cited Findings
- Combine code, model and human graders. Grade the outcome state, not the exact path. pass@k and pass^k differ: 75% per trial gives about 42% for 3 in a row. 20–50 tasks from real failures is a good start. Isolate the environment for each trial. — [Anthropic, Demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- Use realistic multi-step tasks and run each in a simple loop. Track accuracy, runtime, tool-call count, tokens and errors. Read transcripts, keep held-out sets, and let an agent refactor tools from transcript analysis. — [Anthropic, Writing tools](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Trace grading scores individual decisions and tool calls. — [OpenAI safety guide](https://developers.openai.com/api/docs/guides/agent-builder-safety)

### Inferences
- Suggested metrics:
  - The graph passes `validate`.
  - The required action slugs are present.
  - The edge topology matches.
  - No hallucinated slugs.
  - Tool-error rate.
  - Turns used.
- Run the same suite on each target model (free vs paid) to measure the gap.

### Gaps
- I found no public workflow-builder-specific eval suite.
