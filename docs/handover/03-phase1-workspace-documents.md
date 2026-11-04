# 03 — Phase 1: Workspace side bar, documents, middleware

Do the tasks **in order**. Each has: Goal, Files, Spec, Acceptance criteria (AC), Verify.

---

## Task 1 — Finish the `files/documents/` split (backend)

**Goal**: replace `modules/files/documents.ts` (≈260 lines) with small files, same behavior.

**Files** (target layout, each ≤ 100 lines):
```
modules/files/documents/
  index.ts        readDocument(o, file, request) dispatcher + canRead(mime) + re-exports
  types.ts        (exists) ReadOptions, ReadResult, StoredFile, ReadRequest, notDone
  pages.ts        (exists) parsePages, ranges, textParts, letters, TEXT_BUDGET, TEXT_PAGE
  text.ts         (exists) readText(name, text, pages)
  pdf.ts          readPdf(o, file, request): the 3-tier pipeline (text → pictures → OCR)
  pdf-answer.ts   pdfAnswer(findings): formats the page-by-page answer
  pdf-text.ts     (exists) chunkText, subset, CHUNK
  pdf-parse.ts    MOVE from modules/files/pdf-parse.ts
  pdf-images.ts   MOVE from modules/files/pdf-images.ts, minus PNG code
  png.ts          PNG encoder (png, chunk, crc32) split out of pdf-images.ts
  ocr.ts          (exists) ocrPages, ocrPagesToday, OCR_USAGE_MODEL
  office/         Task 3
```
**Spec**
- Copy the logic of the old `readDocument` into `pdf.ts` + `pdf-answer.ts` exactly (lazy chunk parsing, text budget,
  scans detection with `MIN_TEXT = 25`, pictures via `extractPageImages`, OCR via `ocrPages`, figure counts).
- Delete `documents/office.ts` (Workers AI approach rejected) — Task 3 replaces it.
- `modules/files/index.ts` must export `canRead`, `readDocument` from `./documents`.
- Move `documents.check.ts` to `documents/documents.check.ts`, fix imports, update the `check:documents` script path.
- Delete old `documents.ts`, `pdf-parse.ts`, `pdf-images.ts` at `modules/files/` root.

**AC**: `tsc` green; `bun run check` green; `grep -rn "files/documents\"" apps/backend/src` shows only the folder
import; no file in `documents/` > 100 lines; `read_document` output for a PDF is identical to before (Verify).

**Verify**: write a throwaway script that calls `readDocument` on a small text PDF and a scanned PDF with an
in-memory R2 stand-in (pattern in `05` §2 tests: a `Map`-backed `{get, put}` object). Compare with the old output.
Delete the script.

---

## Task 2 — Two PDF tools + complexity check (backend)

**Goal**: `read_document` (free, default) and `read_pdf_advanced` (Mistral OCR, paid, capped). The basic tool detects
complex PDFs and tells the bot to use the advanced tool.

**Files**: `documents/complexity.ts` (new), `documents/advanced.ts` (new), `agent/tools/files/read-pdf-advanced.ts`
(new), edits to `pdf.ts`, `pdf-answer.ts`, `agent/tools/files/index.ts`, `agent/prompts/computer.ts filesSection`.

**Spec — complexity (`complexity.ts`)**
```ts
export interface PdfComplexity { complex: boolean; reasons: string[] }
/** Decides from the pages already read; no extra network call. */
export function assessComplexity(input: {
  texts: Map<number, string>; shown: number[]; scans: number[]; figures: Map<number, number>;
}): PdfComplexity
```
Mark complex when ANY is true (list each as a reason string):
- `scans.length / shown.length >= 0.3` → "mostly scanned pages";
- average figures per page `>= 1` and average letters per page `< 600` → "picture-heavy layout";
- math density: count of `∑∫√≤≥≠±πθλ∞^_{}` or `\frac|\sum|\int` in the text `>= 20` per page → "math notation";
- `(cid:` or `�` occurrences `>= 5` → "broken font encoding";
- table density: lines with ≥ 3 runs of 2+ spaces or `|` `>= 30%` of lines → "complex tables".
`pdfAnswer` appends when complex: `[This PDF looks complex (<reasons>). For exact layout, tables and math call
read_pdf_advanced with the same file_id and pages.]`

**Spec — advanced (`advanced.ts` + tool)**
- `readPdfAdvanced(o, file, pages)`: for each requested page (max 10 per call), Mistral OCR via
  `parsePdf(..., "mistral-ocr")` on a single-page subset, cached at `<storageKey>.parsed/ocr-p<N>.txt`, counted with
  `OCR_USAGE_MODEL` usage rows, capped by `MAX_OCR_PAGES_PER_DAY`. Reuse `ocrPages` — do not duplicate it.
- Also attach page pictures for vision models (reuse `extractPageImages`) so the model can check figures.
- Tool `read_pdf_advanced({ file_id, pages })`: description must say it costs money (≈ $0.002/page), use only after
  `read_document` flagged the PDF as complex or the user asked for exact layout/math.
- `PDF_OCR=off` → the tool returns `NOT DONE: advanced PDF reading is turned off on this server.`

**AC**: a text-only PDF → not complex, no hint; a scanned PDF → complex ("mostly scanned pages"); a PDF with many
formulas → complex ("math notation"); advanced tool returns OCR text per page or a clear `NOT DONE` with the reason
(`key_limit` etc. via `classifyProviderError`); cap enforced; `complexity.check.ts` covers every rule.

**Verify**: unit checks with synthetic `texts` maps; one live call on a 1-page scanned PDF (report the result or the
exact billing error).

---

## Task 3 — Office files for the bot (backend)

**Goal**: `read_document` reads DOCX, XLSX (and XLS if exceljs supports it), PPTX, ODT/ODS (best effort), CSV, MD,
code and text files.

**Files**: `documents/office/index.ts` (dispatcher by mime), `office/docx.ts` (mammoth), `office/xlsx.ts`,
`office/pptx.ts` (jszip), `office/cache.ts` (R2 cache `<storageKey>.parsed/office.md`).

**Spec**
- DOCX: `mammoth.convertToMarkdown({ arrayBuffer })` (check the exact API in `node_modules/mammoth/lib/index.d.ts`;
  if markdown conversion is not available use `extractRawText`). Keep headings/lists.
- XLSX: first try `exceljs` (`new ExcelJS.Workbook().xlsx.load(buffer)`) — **test that it runs in the Worker**
  (`wrangler dev`); if it needs Node streams that Workers lack, parse with `jszip`: `xl/sharedStrings.xml` +
  `xl/worksheets/sheet*.xml` → markdown table per sheet (`## Sheet: <name>`), max 200 rows × 30 cols per sheet with a
  "truncated" note.
- PPTX: `jszip` → `ppt/slides/slideN.xml`, collect `<a:t>` text per slide in slide order (sort numerically) → `## Slide N`;
  include speaker notes from `ppt/notesSlides/` if present.
- Result goes through `readText(name, markdown, pages)` so long files are paged the same way.
- Extend `canRead` and the tool description. Update `filesSection` in `prompts/computer.ts` (one line).
- Mime types to support (already in `files/mime.ts`): docx, xlsx, xls, pptx, odt, ods, csv, md, txt, json, html, xml,
  plus code (`text/*`). Unsupported (`.doc`, `.ppt` legacy binary) → `NOT DONE` explaining the format is too old and
  suggesting "save as .docx/.pptx".

**AC**: real sample files of each type return readable text with headings/slides/sheets; results cached (second call
makes no parse work); `office.check.ts` runs against small fixture files you create with a script (commit the
fixtures under `apps/backend/src/modules/files/documents/office/fixtures/`, each < 50 KB).

---

## Task 4 — Enforced todos + verification for every bot (backend)

**Goal**: every bot plans multi-step work with Deep Agents' `write_todos` and verifies before finishing.

**Read first**: LangChain built-in middleware docs (todo list, tool call limits, model/tool retry) and how
`createDeepAgent` already adds `todoListMiddleware` (search the deepagents dist for `write_todos`).

**Files**: `agent/middleware/todo-guard.ts` (new), edit `middleware/stack.ts`, `prompts/system.ts`.

**Spec**
- Do **not** add a second todo middleware; Deep Agents already provides `write_todos`.
- `todo-guard.ts` (`createMiddleware`, `afterModel` or `wrapModelCall` hook — confirm the hook names in
  `node_modules/langchain/dist/agents/middleware/types.d.ts`):
  - If the model's reply ends the turn (no tool calls) while the state's `todos` contain items with status
    `pending` or `in_progress`, append a system reminder and let the model continue once:
    "You still have unfinished todos: <list>. Finish them, or mark them done/cancelled with write_todos and say why."
    Guard against loops: at most 2 reminders per run (count in middleware state or a closure keyed by run).
  - Before the final answer of a run that used ≥ 3 tool calls, add one verification reminder:
    "Before answering: check each todo is done and verify the result (re-read files you wrote, re-run what you built,
    confirm facts you cite). Then answer."
- System prompt line: "For any task with 3+ steps, write todos first and keep them updated."
- Add LangChain `toolRetryMiddleware` for transient tool failures (network tools only: Tavily, MCP) with
  `maxRetries: 2`, `onFailure: "continue"`. Do NOT retry computer/sandbox actions (they have side effects).
  Model retry already exists at the workflow level (`chat/run/workflow.ts`); do not add `modelRetryMiddleware`
  (a failed half-streamed call would duplicate text — see `run-stream`).

**AC**: a run that stops with pending todos gets one reminder and continues; no infinite loop (check script simulates
3 stops → max 2 reminders); tool retry only on the listed tools; existing behavior unchanged otherwise.

---

## Task 5 — Right side bar → tabbed workspace (web)

**Goal**: the right side bar becomes a workspace with tabs: **Computer** (existing panel, unchanged), **Browser**,
**Files**, and closeable **file tabs**.

**Files** (new folder `apps/web/src/features/workspace/`, each ≤ 100 lines):
```
workspace-provider.tsx   context: tabs[], activeId, open(file), openUrl(url), close(id), setActive(id)
use-workspace.ts         hook reading the context (throws outside the provider)
workspace-sidebar.tsx    replaces ComputerSidebar's content: shadcn Tabs + wide/narrow (Sheet) behavior
workspace-tab-list.tsx   tab strip: fixed tabs + file tabs with close buttons (aria-label "Close <name>")
types.ts                 WorkspaceTab = {id, kind:"computer"|"browser"|"files"|"file", title, file?, url?}
```
**Spec**
- Mount `WorkspaceProvider` in `app/dashboard/bot/[id]/page.tsx` next to `ComputerProvider` (so ChatView can call
  `open(file)`). Keep `ComputerSidebar` file as a thin wrapper or replace its usage — the mobile Sheet must keep working.
- Width: `w-80` when Computer tab active; `w-[34rem]` (xl screens) when a file/browser tab is active. Use a CSS
  transition; no layout jump of the chat.
- Persist the open tabs per bot in `localStorage` (key `k4.workspace.<botId>`), wrapped in try/catch; restore on load;
  max 8 file tabs (oldest closes).
- Keyboard: tabs are reachable with Tab/arrow keys (shadcn Tabs gives this).

**AC**: Computer tab looks and works exactly as before (live view, take control, activity filtered to the bot);
switching tabs keeps the computer's WebSocket alive (do not unmount `ComputerProvider`); file tabs open/close;
state survives reload.

---

## Task 6 — Browser tab (web), DeepSeek design on AI Elements Web Preview

**Goal**: an in-panel browser like DeepSeek Harness's web build (see `05` §2 "Browser component research").

**Files**: `features/workspace/browser/` → `browser-tab.tsx`, `browser-toolbar.tsx`, `use-browser-history.ts`,
`normalize-url.ts`, `normalize-url.check.ts`. Install AI Elements `web-preview` first.

**Spec**
- `WebPreview` + `WebPreviewNavigation` (Back, Forward, Reload, Open externally, Sandbox toggle) + `WebPreviewUrl` +
  `WebPreviewBody`.
- iframe: `sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"`,
  `referrerPolicy="no-referrer"`. Sandbox toggle removes the attribute for the current tab only, shows an amber
  warning bar ("Sandbox off: this page can navigate the app"), not persisted.
- App-managed history: `use-browser-history` keeps a stack `{entries, index}`; Back/Forward disabled at the ends.
- `normalizeUrl`: trims; adds `https://` when no scheme; rejects `javascript:`, `data:`, `file:`, `blob:` and
  private/loopback hosts (`localhost`, `127.*`, `10.*`, `192.168.*`, `172.16-31.*`, `::1`) → shows an inline error.
- Load failure / refusal: browsers hide most framing refusals. Show a persistent hint under the toolbar after load:
  "Page blank? Some sites refuse to open inside apps — Open externally." The external button opens
  `window.open(url, "_blank", "noopener,noreferrer")`.
- Multiple browser tabs allowed (each its own history), via `openUrl(url)` from the workspace context.
- Links the bot sends in chat: add a small "Open in panel" action on links in markdown? **Only** if it is ≤ 30 lines;
  otherwise skip and note it in the report.

**AC**: typing `example.com` loads `https://example.com`; Back/Forward work across 3 navigations; `javascript:alert(1)`
and `http://127.0.0.1` are rejected; sandbox toggle works and warns; `normalize-url.check.ts` covers all rules.

---

## Task 7 — Files tab + file previews (web + one backend param)

**Goal**: list this bot's files; preview, download, delete. Open any file in its own tab with a real viewer.

**Backend**: `GET /api/v1/files?botId=` already exists (`files/routes/browse.ts`). Add nothing unless needed.

**Files** (`features/workspace/files/`): `files-tab.tsx`, `file-row.tsx`, `use-bot-files.ts`, `preview/file-preview.tsx`
(dispatcher by mime), `preview/use-file-blob.ts` (fetch + memory cache), `preview/pdf-view.tsx`,
`preview/image-view.tsx`, `preview/text-view.tsx` (md via `Markdown`, code/text in `<pre>`), `preview/docx-view.tsx`,
`preview/xlsx-view.tsx`, `preview/pptx-view.tsx`, `preview/unsupported-view.tsx`.

**Spec**
- `use-bot-files(botId)`: `listFiles` with `botId` (extend `listFiles(cursor, botId?)` in `features/files/api/library.ts`),
  loads on tab open + refresh button + after delete; "Load more" with cursor.
- Row actions: Open (opens a file tab), Download (`downloadFile`), Delete (reuse `DeleteFileDialog` + `deleteFile`).
- `use-file-blob(file)`: `fetch(fileUrl(id, true), {credentials:"include"})` → `Blob` typed with `file.mimeType`;
  module-level `Map<id, Promise<Blob>>` cache (files are immutable); revoke object URLs on unmount.
- PDF: `<iframe src={objectUrl}>` (browser viewer: layout, math, images). Title + Download button above.
- Images: any `image/*` incl. SVG — SVG must be shown via `<img src=objectUrl>` (never inline `dangerouslySetInnerHTML`).
- DOCX: `const { renderAsync } = await import("docx-preview")` into a container div.
- XLSX: `await import("exceljs")`, render sheets as shadcn `Table` with a sheet switcher (Tabs); cap 500 rows/sheet.
- PPTX: `await import("@aiden0z/pptx-renderer")` — read its README for the API; slide list with prev/next.
- Markdown/text/code/csv/json: decode text; md → `Markdown`; csv → table (first 500 rows); others `<pre>`.
- Unsupported → icon + "Preview not available" + Download.
- Chat integration: add an "Open" button to `features/files/components/file-card.tsx` and image previews that calls
  `useWorkspace().open(file)`; guard for usage outside the provider (the Files page has no workspace → hide button).

**AC**: each type above previews correctly with a real sample; heavy libraries load only when that type opens
(check the Network tab); no file fetched twice; delete updates the list and closes its tab; download works.

---

## Task 8 — Phase 1 verification

Run everything in `06-verification.md` §1–§3 and write the Phase 1 report.
