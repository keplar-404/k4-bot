# Taste
- When investigating issues in this repo: read the project docs and skills first, then use the codegraph MCP tool for code traversal; use firecrawl for web search. Confidence: 0.7
- Wants whole files read end to end, not overviews or line samples — "don't guess, read first": claims about features must be verified in the actual code. Confidence: 0.75
- Prefers very short, concise answers even after a deep/thorough read. Confidence: 0.6
- "Check" / "find the issue" requests are read-only: investigate and report findings, don't change code unless explicitly asked. Confidence: 0.7
- Does not want Sentry (or similar observability/error-monitoring vendors) in his projects: when asked to remove a tool, strip it entirely — dependencies, config wrappers, instrumentation files, env vars — and nothing beyond it. Confidence: 0.6
- Don't delete existing files or rewrite unrelated/adjacent existing files on your own initiative — ask before destructive or creative side effects, and keep changes confined to what was asked. Confidence: 0.65
