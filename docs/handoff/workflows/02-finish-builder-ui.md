# 02 — Finish the builder UI (do this first)

## Steps 1–3 status (as of 2026-11-07)

- **DONE:** type errors fixed. `BlockBody` (a distributive `Omit` of the block union) lives in `builder/blocks.ts` and is used everywhere instead of `Omit<Block, "position">`. `bun run check-types` is clean.
- **DONE:** Biome errors fixed (`<output>` instead of `role="status"`; correct ignore placement). `bunx biome check src/features/workflows` shows warnings only.
- **DONE splits:**
  - `blocks.ts` → `block-catalog.ts` (`BlockInfo`, `BUILT_IN`, `infoOf`);
  - `flow.ts` → `flow-rules.ts` (`wouldLoop`, `connectionProblem`, `placeAfter`);
  - `store.ts` → `store-actions.ts` (`connect`, `addBlockTo`).
- **TODO splits** (still over 100 lines; re-check with `wc -l`):

| File | Lines | Split |
|---|---|---|
| `settings/simple-settings.tsx` | 158 | `delay-settings.tsx` + `set-fields-settings.tsx` |
| `settings/schema-field.tsx` | 153 | one component per field type + a small dispatcher |
| `settings/condition-settings.tsx` | 136 | `condition-ops.ts` (OPS/UNARY) + `condition-row.tsx` |
| `top-bar/top-bar.tsx` | 125 | `power-buttons.tsx` + `more-menu.tsx` |
| `settings/retry-settings.tsx` | 119 | `on-error-select.tsx` |
| `settings/trigger-settings.tsx` | 117 | `schedule-settings.tsx` |
| `settings/app-settings.tsx` | 114 | `app-settings-empty.tsx` (empty/loading states) |
| `block-node.tsx` | 107 | `block-handles.tsx` |
| `features/connect/components/connect-toolbar.tsx` | 103 | `status-filter.tsx` |

After splitting: `bun run check-types` and `bunx biome check --write src/features/workflows src/features/connect src/app/workflows`.

## Step 4: the Run button and the Runs drawer (UI only; the engine is in 03/06)

1. `top-bar/run-button.tsx`: **Run** (manual) for a manual-trigger workflow; **Test run** for schedule and webhook triggers.
   - It POSTs `/:id/run` with `{mode: "test", input?}`. Test mode runs the **draft** graph; real mode runs the published one.
   - For a webhook test run, open a small dialog with a JSON textarea for a sample body (≤256 KB; validate JSON before sending).
   - Disable it while `save.state !== "saved"` or while a run is active. It shows a spinner.
   - Errors (429, cap reached, NOT_READY with issues) appear as toasts. NOT_READY selects the first issue's node.
2. `runs/runs-drawer.tsx` (a shadcn `Sheet` from the right, or a bottom panel):
   - lists `GET /:id/runs`: status badge, trigger, started, duration, failed block name;
   - clicking a run loads it into the canvas overlay (05) and shows its steps list;
   - shows a "Live" pill while a run is active.
3. Pass both into `<TopBar>{children}</TopBar>`.

Add to `features/workflows/api.ts`: `runWorkflow(id, body)`, `listRuns(id)`, `getRun(runId)`, `cancelRun(runId)`, and types `Run`, `RunStep` mirroring the DB rows (dates as ISO strings).

## Step 5: test in the browser (agent-browser)

Use the `next-dev-loop` skill. For each check, take a screenshot and look at it:

- [ ] `/dashboard/workflow` → Create workflow → lands on `/workflows/<id>`; there is no dashboard sidebar
- [ ] Library: search "gmail"; logos load; drag Gmail onto the canvas; clicking adds a block next to the selected one
- [ ] Add Manual trigger → If → two app blocks on true/false. Connecting a block back to an earlier one shows the "loop" toast and creates no edge
- [ ] Settings for an app block:
  - choose the connection (or a Connect button that opens Composio in a new tab, with a refresh after return);
  - choose the action (searchable);
  - the generated fields render (required marks, enums as Select, booleans as Switch, objects as JSON);
  - the `{{…}}` chips insert references;
  - Retry and On-error save
- [ ] Autosave: the indicator goes Saving → Saved; reloading the page shows the same graph. Edits in two tabs give a conflict message (409) in the second tab
- [ ] Issues menu lists unfinished blocks; clicking one selects it; Turn on is disabled until there are no issues
- [ ] Turn on → badge "On"; edit → "Unpublished changes" + Publish changes; Turn off works
- [ ] Webhook trigger: Turn on shows the URL dialog once; the menu → New webhook URL works
- [ ] Light **and** dark: the canvas, minimap, controls, edges and panels all use theme tokens (React Flow dark/light conflicts are already handled in `globals.css` + `flow-theme.ts`)
- [ ] Narrow width (~768 px): the panels collapse or overlay instead of covering the canvas. Below that, a "Use a larger screen to edit" notice is acceptable
- [ ] Keyboard: Delete/Backspace removes the selected block (not while typing in an input); Escape deselects
- [ ] No console errors (`/_next/mcp` `get_errors`)
