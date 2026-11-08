# 04 — Template resolver and condition evaluator

Pure functions with no I/O, used by the engine. Put them in `apps/backend/src/modules/workflows/engine/`, plus a check script like `graph/graph.check.ts` (add `check:engine` to `package.json`).

## Data context

```ts
type RunContext = {
  trigger: unknown;                                      // webhook body / test input / {} for manual / {scheduledAt} for schedule
  steps: Record<string, { output: unknown; error?: string }>;   // by node id
  run: { id: string; startedAt: string };
};
```

The builder's `data-references.tsx` already inserts these reference forms. **Keep the grammar identical to it** (read that file first):
- `{{trigger.body.email}}` (webhook body is under `trigger.body`; also `trigger.headers` with allowlisted headers only, see 06)
- `{{steps.<nodeId>.output.some.path}}`, arrays by index: `{{steps.n1.output.items.0.id}}`
- `{{run.id}}`, `{{run.startedAt}}`
- `{{secrets.NAME}}`: resolved through a `secrets` provider passed in by the engine (decrypts the owner's `user_secret`). **Only allowed in app arguments and HTTP url/headers/body** (`publishIssues` must refuse it in conditions and Set fields). Every value used is added to the run's redaction set (`../agent-platform/03` §A)
- **Never re-resolve:** a resolved value containing `{{…}}` stays literal text (lesson from n8n CVE-2026-27493, `../01-security.md`)

## `template.ts`
- `resolve(text: string, ctx): unknown`
  - The whole string is exactly one reference (`"{{steps.a.output.items}}"`) → return the **raw value** (keeps arrays/objects/numbers).
  - Otherwise → string interpolation; objects become `JSON.stringify`; null/undefined become `""`.
- `resolveDeep(value, ctx)`: walk objects/arrays and resolve every string. Depth ≤ 10. Total output ≤ 100 KB, else throw `TemplateError("Too much data")`.
- Path lookup: split on `.`, allow only `[A-Za-z0-9_-]` segments. **Refuse `__proto__`, `prototype`, `constructor`**. Use `Object.hasOwn`. No `eval`, no `Function`, no expressions or filters (keep it simple for now).
- A missing path resolves to `undefined` (not an error). Conditions can test `exists`.
- Regex: `/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g`, at most 50 references per string.

## `conditions.ts`
`evaluate({combine, conditions}, ctx): boolean`. Resolve `left` and `right` with `resolve`, then:

| op | rule |
|---|---|
| equals / not_equals | compare as numbers if both are numeric strings or numbers, else `String(a) === String(b)` (trimmed); booleans compare to "true"/"false" |
| contains / not_contains | string: case-insensitive `includes`; array: some element equals (same rule as equals) |
| gt gte lt lte | both must be finite numbers (`Number(x)`), else the condition is **false** (not an error) |
| exists / not_exists | not undefined, null or "" (an empty array counts as not existing) |
| is_true / is_false | `true`, `"true"`, `1`, `"1"`, `"yes"` are truthy; the rest are false |

`combine: "all"` → `every`; `"any"` → `some`. An empty list → `false` (publish already blocks it).

## `plan.ts` (branch reachability, also pure, see 03)
`readyState(graph, outcomes) → Map<nodeId, "run"|"skip">`, given each finished node's outcome `{status, ifResult?, passed?}`.

## Check script cases (minimum)
- whole-string reference keeps the type (array, number)
- interpolation in the middle of text; a missing path → `""`
- `__proto__` path → undefined, with no prototype pollution
- the size limit throws
- each operator: numeric vs string equality, contains on an array, gt with non-numbers → false
- If true/false branch skipping; Filter false skips its downstream nodes; a node with two parents where one is skipped and one ran → runs
- onError continue → downstream runs
