# Taste

## Workflow
- Prefers the agent to build complete context up front before receiving/starting a task: read the full project first (structure, tech stack, and how frontend and backend connect), including every file in `.agents/skills` — "don't skip anything", "read each and individual every file's full context and load into your context" — then wait for the task instead of jumping into changes. Confidence: 0.85
- Wants a detailed, flow-oriented plan (current flows, how it should be done well, best practices) for approval before implementation, not a bare task list. Confidence: 0.8

## Coding
- Efficiency-minded about API usage: "don't over call the api" — dedupe/cache repeated frontend fetches (e.g. module-level promise cache + invalidation after mutations) and rate-limit backend endpoints rather than letting clients refetch freely. Confidence: 0.75
- Holds the first pass to a production-grade bar — "it works" is not enough: bake in hardening and performance patterns when initially building a feature (e.g. locked-down CORS, stricter auth config, cached DB/auth singletons) instead of delivering minimal code that only gets optimized later, after the user does it and asks why. Confidence: 0.8
