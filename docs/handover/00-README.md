# K4 Bot: Handover Guide for the Implementing Agent

You are implementing two phases of work on the K4 Bot monorepo. This folder is your **only** source of truth.
Read every file in this folder **in order** before you write a single line of code. Do not skim.

| File | What it gives you |
|---|---|
| `00-README.md` (this file) | How to work, the golden rules, the definition of done, when to stop and ask |
| `01-project-map.md` | How the app works today: architecture, every important file, data flow, conventions |
| `02-code-standards.md` | Mandatory code rules with good/bad examples taken from this codebase |
| `03-phase1-workspace-documents.md` | Phase 1 tasks: exact specs, file paths, acceptance criteria, tests |
| `04-phase2-coding-agent.md` | Phase 2 tasks: sandbox manager, coding bot, async/dynamic sub-agents, code editor, evals |
| `05-references.md` | Verified facts, library versions, docs links, things already tested |
| `06-verification.md` | Commands to run, manual QA scripts, and the report you must hand back |

---

## 1. The golden rules (breaking any of these fails the review)

1. **Never guess an API.** Before using a library function, open its type definitions in `node_modules` or its
   official docs (links in `05-references.md`). If you cannot confirm it exists with that exact signature, do not use it.
2. **Never run a formatter on the whole repo.** `biome check --write` on a folder rewrote ~227 files once. Only ever
   format the exact files you changed: `bunx biome check --write <file1> <file2> …`.
3. **No file over 100 lines** in any file you create or substantially change. Split by responsibility (see `02`).
4. **One responsibility per file / function** (SOLID, see `02`). A tool file defines one tool. A route file handles one
   resource. A React component renders one thing.
5. **Every task ends green**: `bunx tsc --noEmit` passes in the app you touched, the check scripts pass, and you did
   the manual QA steps in the task. Never move to the next task with a red build.
6. **Do not delete or weaken existing features.** Everything listed in `01-project-map.md` must still work.
7. **Do not touch secrets.** Never print, log, commit or send `.dev.vars` / `.env` values anywhere.
8. **Database changes go through Drizzle only**: edit `apps/backend/src/db/schema/*.ts`, then
   `bun run db:generate`, read the generated SQL, then `bun run db:migrate`. Never hand-edit applied migrations.
   Never run destructive SQL (DROP, DELETE without WHERE, TRUNCATE).
9. **No new npm package** unless it is listed in `05-references.md` → "Approved packages", at the version listed (or
   newer patch). If you think you need another one, STOP and ask (section 4).
10. **Commit only when the user asks.** Work on the current branch; do not push.
11. **Write the report** in `06-verification.md` format at the end of every phase. Be honest: list what you could not
    verify. A false "done" is worse than an honest "not done".

## 2. How to work on each task

For every numbered task in `03` and `04`, follow this loop exactly:

1. **Read** the task fully, then open and read every file it names (whole files, not snippets).
2. **Trace** the flow: who calls the code you will change? (`grep` the function name across `apps/`.)
3. **Plan** in a short todo list: which files you create/change, in what order.
4. **Implement** the smallest change that meets the acceptance criteria. Reuse existing helpers first (see `01` §6).
5. **Type-check**: `cd apps/backend && bunx tsc --noEmit` and/or `cd apps/web && bunx tsc --noEmit`.
6. **Check scripts**: backend `bun run check`; web `bun run check:chat`. Add a `*.check.ts` for new logic (see `02` §8).
7. **Format only your files**: `bunx biome check --write <your files>`, then `bunx biome check <your files>` must show
   no errors (warnings that already existed are fine; do not "fix" unrelated warnings).
8. **Manual QA**: do the steps listed under the task's "Verify" heading.
9. **Tick the acceptance criteria** one by one in your notes. If any is not met, go back to step 4.

## 3. Definition of done (per phase)

- Every acceptance criterion of every task in the phase is met and demonstrated.
- `bunx tsc --noEmit` passes in `apps/backend` and `apps/web`.
- `bun run check` (backend) and `bun run check:chat` (web) pass, including your new check scripts.
- No file you created or substantially changed exceeds 100 lines.
- `git status` shows only files you meant to change (no mass reformatting, no stray test files like `.q.ts`).
- The phase report (`06-verification.md` template) is written and handed back.

## 4. When to STOP and ask instead of guessing

Stop and write a question (do not continue that task) when:

- An API you need does not exist in the installed version, or behaves differently from these docs.
- A task would require a package not in the approved list.
- A test needs a paid service that fails with a billing/limit error (OpenRouter "Key limit exceeded", E2B quota).
- A requirement here conflicts with existing behavior you would have to remove.
- A migration would change or drop existing columns/tables.
- You are unsure whether something is a security risk (user files, tokens, sandbox access, iframes).

You may continue with other independent tasks while waiting.

## 5. Known current state you must handle first

- **Unfinished refactor**: `apps/backend/src/modules/files/documents/` contains six new files (`types.ts`, `pages.ts`,
  `text.ts`, `office.ts`, `pdf-text.ts`, `ocr.ts`) that are **not wired in** and do not type-check yet (they import
  `./pdf-parse`, `./pdf-images`, `./pdf` which are not in that folder). The working implementation is still
  `apps/backend/src/modules/files/documents.ts` + `pdf-parse.ts` + `pdf-images.ts`. Phase 1 Task 1 finishes this.
  `documents/office.ts` uses Workers AI `toMarkdown`: **the user rejected that approach** (it needs `wrangler login`).
  Replace it as described in Phase 1 Task 3.
- **Reformatted web files**: an earlier `biome check --write` reformatted many files under `apps/web/src/features`.
  Do not revert or reformat anything yourself; the user will decide. Just never repeat it.
- The OpenRouter key has a small spending limit. Free models (`openrouter/free`) work. Paid calls may fail with
  "Key limit exceeded" — report it, do not work around it.
