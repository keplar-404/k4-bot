# Development guide

## Code standards

| Rule | Detail |
|---|---|
| **≤ 100 lines per file** | Split by responsibility when a file grows. Exempt: `apps/web/src/components/ui/*` (shadcn), `lib/bloub/bot/*`, generated files (migrations, `worker-configuration.d.ts`) |
| Feature folders | Backend `src/modules/<feature>`, web `src/features/<feature>`. Pages in `app/` stay thin |
| Single responsibility, no ceremony | Plain functions and small modules; no class hierarchies or value objects unless the module already uses them (the computer Durable Object does) |
| Hono route chaining | Define routes on one chained Hono instance so `AppType` carries their types to the web |
| Validate at the boundary | zod for every body, query and param (`shared/validate.ts`); never trust the browser |
| Readable code | Names say what things are; comments explain *why*, never restate the code. Keep existing comments and guards |
| Prompts | Every model-facing text in `apps/backend/src/prompts/` |
| Base UI | `render={<Link />}` with `nativeButton={false}`; never `asChild` |

## Commands

| Where | Command | What |
|---|---|---|
| root | `bun run dev` | Both apps (Turborepo) |
| root | `bun run check-types` | Type-check both apps |
| `apps/backend` | `bun run dev` | `wrangler dev` on :8787 |
| `apps/backend` | `bun run check` | Every `*.check.ts` script (grouped as `check:workflows`, `check:engine`, `check:web`, …) |
| `apps/backend` | `bun run db:generate` / `db:migrate` | Create / apply migrations |
| `apps/backend` | `bun run composio:webhook <url>` | Point Composio event delivery at an API URL |
| `apps/web` | `bun run dev` / `build` | Next.js |
| `apps/web` | `bunx biome check --write <paths>` | Format and lint (Biome) |

## Tests

The backend uses small, fast **check scripts** next to the code (`*.check.ts`), run with Bun and `node:assert`. They
cover pure logic and route behaviour that needs no external service: templates, conditions, the graph rules, the
schedule calculator (time zones, DST, month ends), the walk (loops, approvals) with a fake Workflow step, the HTTP
guard, argument fitting, event signature checks, encryption, sandbox policy, middleware and modes.

Add a check script for every new piece of non-trivial logic and register it in `apps/backend/package.json`.

End-to-end testing runs the backend with `wrangler dev` on a spare port against a real database, signs up throwaway
users (`e2e-…@example.com`), exercises the API, and deletes the users afterwards.

## Database migrations

1. Change the schema in `apps/backend/src/db/schema/`.
2. `bun run db:generate`: review the SQL in `apps/backend/drizzle/`.
3. `bun run db:migrate`.
4. Commit the SQL and the snapshot in `drizzle/meta/` together.

Never edit an applied migration. For JSON columns (workflow graphs, schedules), prefer schema defaults over data
migrations: stored values are parsed with defaults when read.

## Adding things

### A backend module

`src/modules/<name>/` with `routes.ts` (chained Hono, `authGuard`, zod), a `store.ts` for queries (every query scoped
by user), and the logic in small files. Mount it in `src/routes.ts`. Add tables in `src/db/schema/<name>.ts` and export
them from `schema/index.ts`.

### A workflow block

1. Config schema in `modules/workflows/graph/` and the node in `graph/schema.ts`.
2. Publish rules in `graph/validate.ts` (`blockIssue`).
3. Execution in `engine/execute-block.ts` (or a durable runner in `engine/run-node.ts` if it waits).
4. Web: default in `builder/new-block.ts`, entry in `block-catalog.ts`, title in `block-label.ts`, settings component in
   `builder/settings/` wired in `block-settings.tsx`.
5. Bot help in `src/prompts/workflow-tools.ts`, and a case in a check script.

### An agent tool

Create it with LangChain's `tool()` and a zod schema; validate arguments, re-check ownership, clip output, never return
secrets. Add it to the right tool set (`agent/agent.ts` or `account-tools.ts`). If it changes anything, add an approval
in Ask mode; add it to `PLAN_ALLOWED` in `agent/modes.ts` only if it is read-only.

## Git

- Work on `development`; `main` is for releases.
- Never commit `.env`, `.dev.vars` or `.env.local` (all git-ignored).
- Commit messages end with the `Co-Authored-By` line when an AI assistant wrote the change.
