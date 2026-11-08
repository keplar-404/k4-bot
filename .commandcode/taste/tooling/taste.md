# Tooling

- Prefers @thesvg/react for brand/company logos (imported via subpaths for tree-shaking) instead of generic icon libraries like lucide-react. Confidence: 0.8
- Prefers OpenRouter as the LLM provider for LangChain deep agents (OpenAI-compatible endpoint, namespaced model ids like `anthropic/claude-sonnet-4`), rather than relying on Cloudflare AI Gateway/Workers AI alone. Confidence: 0.7
- Prefers LangChain deep agent as the sole AI agent framework, running as part of the backend (not inside the Sandbox), with a Sandbox SDK full-Linux machine used only as a code-execution tool the agent calls; rather than mixing in Workers AI / edge-native agent loops or running the agent inside the sandbox — and to leverage its built-in middleware/features (TodoList, Filesystem, SubAgent, HITL, Memory) rather than reimplementing them. Confidence: 0.8
- Prefers to keep Neon serverless Postgres as the database (not avoid it); Hyperdrive is only for Worker-side DB access, while the agent connects to Neon directly from its container. Confidence: 0.7
- Prefers using the CodeGraph MCP server heavily when exploring/understanding the codebase (not just during project review), instead of manually exploring the code or spawning agents. Confidence: 0.95
