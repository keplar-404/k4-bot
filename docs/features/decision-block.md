# Decide block (TypeSafe Jev)

A workflow block that asks TypeSafe's **Jev** decision model typed questions about some data and returns calibrated
probabilities instead of text. Use it to route, triage and filter: *is this urgent?*, *which team?*, *how relevant?*

Needs `TYPESAFE_API_KEY` (https://console.typesafe.ai). Without it the block fails with "not set up on this server".

## Settings

| Setting | Meaning |
|---|---|
| State | What the questions are about (an email, a ticket, a record). Add data with **+**; filled-in values are wrapped as data, so text inside them cannot change the questions |
| Questions (1–16) | Each has a name (the output key), a type and its wording |
| Model | `jev-latest` (follows new versions) or a pinned id such as `jev-1.13.0` |

Question types:

| Type | Criteria | Answer (`{{steps.<block>.output.answers.<name>.…}}`) |
|---|---|---|
| Yes / no (`noul`) | optional "counts as yes" / "counts as no" | `.noul`: probability of yes, 0–1 |
| Pick one (`choice`) | 2–50 labels, each with what it means | `.choice`: the label; `.confidence`; `.probabilities` |
| Score (`score`) | 2–10 levels, lowest first | `.score`: expected value 0–1 (**not** a level); `.confidence` |

## Using the answers

Branch with an **If** block using ranges, never equality:

- `{{…answers.urgent.noul}}` *is greater than* `0.7` → escalate.
- `{{…answers.relevance.score}}` *is less than* `0.4` → close.

Three things to know (from TypeSafe's guidance):

1. A score is a probability-weighted average, so it is rarely exactly 0 or 1.
2. Confidence measures how concentrated the answer is, not whether it is correct: use it only for ambiguous middle values.
3. Thresholds change between model versions: pin the model once tuned.

Wording matters more than thresholds: say what counts and what does not.

## Limits and cost

1,000 decisions per user per 24 hours; tokens are recorded in `agent_usage` (`model = typesafe/<version>`). Bad
requests and a bad key fail at once; rate limits and server errors retry with the block's retry settings.

## Code

`apps/backend/src/modules/decisions/client.ts` (official SDK `@typesafe-ai/sdk`),
`modules/workflows/graph/decide-block.ts` (schema), `graph/decide-issues.ts` (publish rules),
`engine/blocks/decide.ts` (run, caps, usage); web `features/workflows/builder/settings/decide/`.
Bots learn the block from `apps/backend/src/prompts/workflow-tools.ts`.
