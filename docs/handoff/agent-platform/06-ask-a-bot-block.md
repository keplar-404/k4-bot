# 06 — "Ask a bot" workflow block (NOT confirmed: ask the user first)

The reverse direction: a workflow step hands a task to one of the user's bots (n8n's AI Agent node, Zapier's AI step). Proposed but never confirmed. Ask: "Do you also want a workflow step 'Ask a bot', for example 'summarise these emails' or 'classify this lead'?"

If yes:
- Node `ai.bot { botId, prompt: template, output: "text"|"json", jsonShape?, allowApps: boolean }` + retry/onError.
- Execution:
  - run the bot **headless** (`buildAgent` without a thread, computer or sub-agents);
  - tools: web search, plus (if `allowApps`) only `app_find_actions` / `app_action_details` / `app_read`;
  - **no write tools, no workflow tools, no `request_secret`**: there is nobody to ask, and recursion stays impossible;
  - one `step.do`, 5 min timeout, 8k output tokens; usage into `agent_usage` (`runId = wf:<runId>:<nodeId>`);
  - ≤100 such steps per user per day.
- Output `{text}` or the parsed `{json}` (one repair attempt).
