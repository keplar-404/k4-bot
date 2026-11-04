# Coding eval results

Run 2026-11-04T11:28:36.329Z.

- **openai/gpt-4o-mini**: 5/5 passed
- **openrouter/free**: 4/5 passed

| Model | Task | Pass | Tool calls | Tokens | Time | Note |
|---|---|---|---|---|---|---|
| openai/gpt-4o-mini | fix-bug | ✅ | 4 | 17307 | 17s |  |
| openai/gpt-4o-mini | implement-spec | ✅ | 5 | 19122 | 21s |  |
| openai/gpt-4o-mini | refactor-keep-behaviour | ✅ | 11 | 42149 | 32s |  |
| openai/gpt-4o-mini | build-cli | ✅ | 2 | 8071 | 9s |  |
| openai/gpt-4o-mini | read-and-answer | ✅ | 9 | 23490 | 18s |  |
| openrouter/free | fix-bug | ✅ | 12 | 50233 | 48s |  |
| openrouter/free | implement-spec | ❌ | 0 | 0 | 82s | run failed: Recursion limit of 120 reached without hitting a stop condition. You can increase the limit by setting the "recursionLimit" config key.

Troubleshooting URL: ht |
| openrouter/free | refactor-keep-behaviour | ✅ | 17 | 49908 | 91s |  |
| openrouter/free | build-cli | ✅ | 7 | 45671 | 32s |  |
| openrouter/free | read-and-answer | ✅ | 13 | 49034 | 51s |  |
