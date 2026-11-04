# 02 — Code Standards (mandatory)

The reviewer checks every rule below. Each rule has a reason; follow the reason when a case is not covered.

## 1. Size and responsibility

- **Max 100 lines per file** you create or substantially change (comments and blank lines count). If a file grows
  past 100, split it by responsibility *before* adding more.
- **One job per file.** Examples from this repo:
  - `modules/files/documents/pages.ts` only parses page ranges and splits text.
  - `modules/agent/middleware/free-vision.ts` only switches the model for image calls.
  - `modules/agent/tools/files/read-document.ts` only defines the `read_document` tool and delegates the work.
- **Functions do one thing, ≤ ~40 lines.** If you write "and" when describing a function, split it.

## 2. SOLID, applied to this codebase

| Principle | What it means here | Example |
|---|---|---|
| Single responsibility | A tool file wires a tool; the logic lives in a module | `read-document.ts` (tool) → `files/documents/*` (logic) |
| Open/closed | Add behavior by adding a file/entry, not by editing a big switch | New bot role = new file in `agent/domains/` + one registry line |
| Liskov | Implementations of an interface are interchangeable | Every backend implements Deep Agents' backend protocol |
| Interface segregation | Pass only what a function needs | `MemoryToolsOptions` has just `saveMemory` / `savePreferences`, not the whole `Db` |
| Dependency inversion | Modules receive dependencies as parameters | `readDocument(o: ReadOptions, …)` gets `bucket`, `db`, `apiKey` — it never reads env itself |

## 3. TypeScript

- `strict` is on. No `any` (use `unknown` + narrowing). No `@ts-ignore`. `as never`/`as unknown as` only in tests.
- Prefer `type`/`interface` exported next to the code that owns it.
- Zod schemas for every external input (HTTP body, tool args). Tool schemas need `.describe()` on non-obvious fields.
- Return result objects for expected failures: `{ ok: true, value } | { ok: false, error }`. Throw only for bugs.

## 4. Comments

Match the existing density: one short doc comment per exported function/type explaining **why** or **what it
guarantees**, not restating the code.

```ts
// GOOD (from chat-model.ts): explains the non-obvious reason
/** The free router: the plugin's text reaches the model as input, so a paid model would bill it as tokens. */
const PARSE_MODEL = "openrouter/free";

// BAD: restates the code
/** The parse model constant. */
const PARSE_MODEL = "openrouter/free";
```

Use `// ponytail:` only for a deliberate shortcut with a known ceiling, naming the upgrade path.

## 5. Errors and messages

- Tool failures return text starting with `NOT DONE:` and say what failed and why, in words the bot can repeat.
- User-facing errors: plain sentences, no stack traces, no raw provider JSON. Add a reason to
  `classifyProviderError` + `REASON_COPY` if you introduce a new provider failure kind.
- Never swallow errors silently. `catch(() => undefined)` is allowed only for best-effort cleanup, with a comment.

## 6. Security (never simplify these away)

- Every route that touches user data: `authGuard` + ownership check (`and(eq(table.id, id), eq(table.userId, userId))`).
- Every write route: `userLimit`.
- File content served from the API: keep `Content-Security-Policy: default-src 'none'; sandbox` (see `files/routes/browse.ts`).
- iframes showing untrusted pages: always `sandbox` by default, `referrerPolicy="no-referrer"`.
- Secrets: only through env/`encryptSecret`. Never in logs, prompts, tool output or the client bundle.
- Sandbox commands: run as an unprivileged user, quote with the existing helpers in `computer/guards.ts`, cap output.
- Anything that destroys user data (delete sandbox, reset computer) needs a confirmation (UI) or an approval
  interrupt (agent). Follow `computer/durable/session.ts reset()` and `vm/reset-computer.tsx`.

## 7. Performance, caching, rate limiting

- **Backend**: cache derived data in R2 next to the source (`<storageKey>.parsed/...`), as `files/documents` does.
  Delete those caches when the source is deleted (`files/routes/browse.ts` delete handler).
- **No N+1**: one query with `inArray` instead of a loop of queries.
- **External APIs**: timeout every `fetch` (`AbortSignal.timeout(ms)`); retry once only for transient failures.
- **Frontend**: immutable resources (stored files) are cached in memory by id; lists refetch only on tab open or
  explicit refresh — never on an interval unless the task says so. Heavy viewers (`docx-preview`,
  `@aiden0z/pptx-renderer`, `exceljs`, `pdfjs-dist`) are loaded with `await import(...)` / `next/dynamic` only when
  that file type is opened.

## 8. Tests: one runnable check per non-trivial module

The repo uses plain `*.check.ts` scripts run by Bun, no test framework. Pattern (copy it):

```ts
// apps/backend/src/modules/files/documents.check.ts (existing)
import assert from "node:assert/strict";
import { parsePages, ranges } from "./documents";

assert.deepEqual(parsePages("2,5-7,6,99", 8), [2, 5, 6, 7], "ranges, repeats and out-of-range pages");
assert.equal(ranges([1, 2, 3, 7, 9, 10]), "1-3,7,9-10");
console.log("documents: all checks passed");
```

Then register it in `apps/backend/package.json`:
`"check:<name>": "bun run src/.../<name>.check.ts"` and append `&& bun run check:<name>` to `"check"`.
Web checks go under `apps/web/src/...` and into the web `check:chat` script the same way.

Checks must not need secrets or network unless the task says "live test". Live tests are throwaway scripts you
delete afterwards (`rm ./.live-test.ts`) — never commit them.

## 9. React / UI

- Use **shadcn/ui components** from `@/components/ui/*` first; **AI Elements** for agent UI (web preview, file tree,
  terminal, code block, artifact, test results). Write a custom component only when neither has it.
- Base UI (not Radix): triggers use the `render` prop pattern (see `bot-item.tsx`: `<DropdownMenuTrigger render={...}>`).
- Accessibility: every icon-only button has `aria-label`; dialogs have titles; loading states use `aria-busy`.
- Client components start with `"use client"`. Keep state close to where it is used; share via a small context
  (pattern: `features/computer/components/computer-provider.tsx`).
- No layout shift: reserve space for loaders (`Skeleton`).

## 10. Formatting and lint

- After editing, run `bunx biome check --write <only your files>` then `bunx biome check <only your files>`.
- Never `--write` a directory. Never `--unsafe`.

## 11. Naming

- Files: kebab-case (`read-document.ts`). Components: PascalCase. Hooks: `useX`. Check scripts: `<name>.check.ts`.
- Tools: snake_case verbs (`read_pdf_advanced`, `sandbox_exec`). Env vars: UPPER_SNAKE with a doc comment in `config/env.ts`.

## 12. Review checklist (self-check before you report)

- [ ] Every new/changed file ≤ 100 lines; one responsibility each.
- [ ] No `any`, no unchecked external input, no hard-coded secrets.
- [ ] Ownership + rate limit on every new route.
- [ ] New logic has a `*.check.ts`, registered in package.json, passing.
- [ ] Heavy front-end libs are lazy-loaded.
- [ ] `tsc` green in both apps; biome clean on your files; `git status` shows only intended files.
