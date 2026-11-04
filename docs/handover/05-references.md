# 05 — References and verified facts

Everything in "Verified" was tested in this repo on 2026-11-04. Treat it as true. Everything else: confirm in the
installed types or the linked docs before relying on it.

## 1. Approved packages (install only these; check the version is still current with `npm view <pkg> version`)

| Package | Version | Where | Why / notes |
|---|---|---|---|
| `pdf-lib` | 1.17.1 (installed) | backend | Read PDF structure, page count, embedded images, page subsets. Pure JS, runs on Workers |
| `mammoth` | ^1.13.0 | backend | DOCX → text/markdown for the bot. Pure JS |
| `exceljs` | ^4.4.0 | web (+ backend if it runs on Workers — test it) | XLSX read. **Do NOT use `xlsx` from npm**: open high-severity advisories (GHSA-4r6h-8v6p-xvw6 prototype pollution, GHSA-5pgg-2g8v-p4x9 ReDoS) |
| `jszip` | already a transitive dep; add explicitly ^3 | backend | Read PPTX/XLSX XML when a lib does not run on Workers |
| `docx-preview` | ^0.4.1 | web | Renders DOCX with real page layout in the browser |
| `@aiden0z/pptx-renderer` | ^1.4.0 | web | Renders PPTX slides in the browser. Apache-2.0, public repo github.com/aiden0z/pptx-renderer |
| `pdfjs-dist` | ^6.5 | web (optional) | Only if the browser's built-in PDF viewer in an iframe is not enough |
| AI Elements components | via `npx ai-elements@latest add <name>` | web | `web-preview`, `file-tree`, `terminal`, `code-block`, `artifact`, `test-results`, `stack-trace`, `commit`, `sandbox`. Docs: https://elements.ai-sdk.dev/components/<name> |
| `@langchain/quickjs` | ^0.6.5 | backend | Dynamic sub-agents interpreter (beta). Must be proven to run on Workers first (Phase 2) |
| `e2b` / `@e2b/desktop` | installed | backend | Sandboxes. Coding sandbox may use the `e2b` SDK with the `code-interpreter`/`base` template |

Rejected: `xlsx` (npm, vulnerable), `pptx-preview` (no public source repo), `pptxjs`/`pptx2html` (abandoned),
Cloudflare Workers AI `toMarkdown` for Office (needs `wrangler login`; user said no).

## 2. Verified facts

**OpenRouter**
- PDF parsing via the `file-parser` plugin works with model `openrouter/free`, engine `cloudflare-ai`: cost 0, ~0.6 s,
  returns a `file` annotation whose text has a metadata block, then `## Contents`, then `### Page N` per page.
  Implemented in `modules/files/pdf-parse.ts` (`parsePdf`, `splitPages`).
- `cloudflare-ai` returns **empty pages for scanned PDFs** and drops text drawn as images.
- `mistral-ocr` engine costs $2 per 1,000 pages; recommended for scans/complex layouts. It was blocked in testing
  only by the key's spending cap. Request shape is the same as `cloudflare-ai` with `pdf: { engine: "mistral-ocr" }`.
- Free-model limits: 20 requests/min; 50/day (1,000/day after buying ≥ 10 credits). Daily cap error contains
  `free-models-per-day`.
- `openrouter/free` sometimes routes image calls to text-only models → fixed by `middleware/free-vision.ts`.
- Key spending cap error: `Key limit exceeded (total limit)` (HTTP 403) → reason `key_limit`.
- Prompt caching: Anthropic needs top-level `cache_control: {type:"ephemeral"}` (sent by `cachingFor`); OpenAI,
  DeepSeek, Grok, Moonshot, Groq, Gemini 2.5+ cache automatically. `openrouter/free` reported `cached_tokens: 0`.

**PDF images (`modules/files/pdf-images.ts`)**
- Scanned page JPEG (DCTDecode) extracted byte-for-byte and read correctly by `google/gemma-4-31b-it:free`.
- Uncompressed / Flate RGB or Gray (incl. ICCBased N=1/3) rebuilt into valid PNG; formula image transcribed to LaTeX.

**Deep Agents (installed 1.16.2)**
- Default summarization: 85% trigger, keep 10%; this repo sets 80% (`middleware/stack.ts`).
- A custom middleware with the same `name` as a built-in replaces it (`mergeMiddlewareStack`).
- `createSummarizationMiddleware` uses `request.model` if present; the repo passes a `nostream`-tagged model so the
  summary does not stream into chat.
- Async sub-agents in Deep Agents require an **Agent Protocol server** (LangSmith Deployment) — not available on
  Workers. The user chose to build the same 5 tools on Cloudflare (Phase 2).

**Browser component research**
- DeepSeek Harness (github.com/deepseek-ai/deepseek-harness, `packages/client/ui-sidebar-browser`): desktop uses
  Electron `<webview>`; **web build uses a sandboxed iframe** (`IframeImpl.ts`, `IframePresentation.ts`) with
  sandbox `allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox`,
  `referrerPolicy = 'no-referrer'`, app-managed history (back/forward/reload), address persisted per tab, HTTPS added
  when no scheme, a toolbar toggle to drop the sandbox with an amber warning, and "Open in system browser" for sites
  that refuse framing. It does not proxy pages. **Copy this design.**
- AI Elements `web-preview`: `WebPreview`, `WebPreviewNavigation`, `WebPreviewNavigationButton` (tooltip),
  `WebPreviewUrl`, `WebPreviewBody` (iframe props spread), `WebPreviewConsole`.

## 3. Docs to read before the matching task

| Topic | Link |
|---|---|
| Deep Agents overview / customization / middleware | https://docs.langchain.com/oss/javascript/deepagents/overview , …/customization |
| Deep Agents context engineering (summarization) | https://docs.langchain.com/oss/javascript/deepagents/context-engineering |
| Deep Agents subagents / async / dynamic / interpreters | https://docs.langchain.com/oss/javascript/deepagents/subagents , …/async-subagents , …/dynamic-subagents , …/interpreters |
| LangChain prebuilt middleware (todo list, model/tool retry, tool call limit) | https://docs.langchain.com/oss/javascript/langchain/middleware/built-in |
| OpenRouter PDFs / errors / limits / caching | https://openrouter.ai/docs/features/multimodal/pdfs , /docs/api-reference/errors , /docs/api-reference/limits , /docs/features/prompt-caching |
| E2B docs (also the `e2b-docs` MCP server) | https://e2b.dev/docs |
| Cloudflare Workflows / Durable Objects / Cron | https://developers.cloudflare.com/workflows/ , /durable-objects/ , /workers/configuration/cron-triggers/ |
| AI Elements | https://elements.ai-sdk.dev/components |
| Coding harness research (Phase 2 task 1) | Anthropic "Building effective agents" & Claude Code docs, OpenHands, SWE-agent (ACI design), Aider repo-map |

## 4. Project skills to load (in `.agents/skills/`)

`e2b-computer` (computer rules), `domain-bots` (bot roles/sub-agents), `deep-agents-core`, `deep-agents-orchestration`,
`langchain-middleware`, `cloudflare`, `durable-objects`, `drizzle-orm`, `hono`, `shadcn`, `ai-elements`.
