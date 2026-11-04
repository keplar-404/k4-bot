# 06 — Verification and the report you hand back

## 1. Automated (must all pass)

```
cd apps/backend && bunx tsc --noEmit && bun run check
cd apps/web && bunx tsc --noEmit && bun run check:chat
bunx biome check <every file you created or changed>      # no errors
```
**Boot gate (mandatory, `tsc` does not catch bundling errors):**
```
cd apps/backend && bunx wrangler dev --port 8799      # in a second terminal
curl -s -o /dev/null -w "%{http_code}" localhost:8799/api/v1/health   # must print 200
```
The wrangler log must contain no `ERROR` / `Build failed`. Paste the curl result in the report.

Line-count check (no output = pass):
```
git diff --name-only HEAD | grep -E '\.(ts|tsx)$' | xargs -I{} sh -c 'n=$(wc -l < "{}"); [ "$n" -gt 100 ] && echo "{} $n"'
```
(Pre-existing large files you only touched lightly may be listed — say so in the report; new files must pass.)

## 2. Manual QA — Phase 1

Run `wrangler dev` (apps/backend) and `next dev` (apps/web), sign in, open a bot.

1. Right side bar shows tabs Computer / Browser / Files. Computer works as before (live view, activity of this bot only).
2. Browser: `example.com` loads; Back/Forward/Reload; `javascript:alert(1)` rejected; `localhost:3000` rejected;
   sandbox toggle shows the amber warning; Open externally opens a new browser tab.
3. Files: upload in chat a PDF, a scanned PDF, a DOCX, an XLSX, a PPTX, a PNG, an SVG, a `.md`, a `.csv`.
   Each appears in Files; Open shows the right viewer; Download saves the file; Delete removes it and closes its tab.
4. Chat: ask the bot "summarize each attached file". It calls `read_document`; for the scanned/complex PDF it suggests or
   calls `read_pdf_advanced`; answers cite pages/slides/sheets.
5. Ask a 4-step task; the bot writes todos, completes them, and verifies before answering.
6. Reload the page: open tabs are restored.

## 3. Manual QA — Phase 2

1. Create a Coding bot. Ask: "create a small Express app with a /health route and a test, run the test".
   It starts a sandbox (status visible), writes files, runs tests, shows the preview.
2. Open the code editor: the tree shows files; agent edits appear live; edit a file, Save, ask the bot to run tests.
3. Close the editor, wait past the idle window: sandbox pauses. Open again: resumes with files intact.
4. Ask a second bot to delete the first bot's sandbox: approval dialog shows owner, purpose, last used. Reject → kept.
5. Create sandboxes until the limit: the next one is refused with a clear message.
6. Global Sandboxes page lists all with correct status; Pause/Start/Delete work.
7. Async: "start a background task to research X while we continue". `list_async_tasks` shows it; it finishes; result arrives.
8. Run the evals; attach `results.md`.

## 4. Report template (copy, fill every section, hand back)

```md
# Phase <1|2> report

## Summary
<2–4 sentences: what now works>

## Tasks
| Task | Status (done / partial / blocked) | Files | Notes |
|---|---|---|---|

## Acceptance criteria
<For each task: each AC with ✅/❌ and how you verified it (command, screenshot description, output excerpt)>

## Commands run and results
<paste the tail of each command in §1>

## Manual QA
<each step in §2/§3 with result>

## Not verified / blocked
<anything you could not test and exactly why (e.g. "Key limit exceeded" text)>

## Deviations from the spec
<what you did differently and why>

## New dependencies
<package@version, why, link to its repo>

## Files over 100 lines
<list, with reason>

## Questions for the reviewer
```

The reviewer will re-run §1, spot-check §2/§3, read the diff, and send fix instructions. Do not argue with a failed
check — fix it or explain with evidence.
