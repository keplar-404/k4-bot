---
name: domain-bots
description: How this project builds domain-specific bots (research, coding, writing, ...) on one agent: domain specs, web tools, parallel tool calls, sub-agent groups, skills and MCP apps. Use when adding or changing a bot role/domain, the bot's tools or capabilities, spawn_subagents, or the bot form's capabilities.
---

# Domain bots (this project)

Every bot is the same Deep Agent (`apps/backend/src/modules/modules/agent/agent.ts`). Its **role** picks a **domain spec** that
changes only configuration: the playbook in the prompt, the web tools, sub-agent briefing, and the defaults a new
bot of that role starts with. Users can still change every capability per bot.

## Layout

```
apps/backend/src/modules/agent/
  domains/
    types.ts            DomainSpec + hard limits (MAX_SUBAGENTS 20, MAX_PARALLEL_TOOLS 10)
    index.ts            registry: domainFor(role), publicDomains() for GET /bots/domains
    general.ts          assistant, advisor, coding, writing, custom (playbook + defaults)
    research/           a domain with its own prompts gets a folder
      index.ts          spec (sub-agents on, 6 / 10)
      prompts.ts        lead playbook + RESEARCHER_BRIEF for its sub-agents
  tools/
    web/                Tavily tools for every bot (search/extract/map/crawl; research only in /deep-research) + spend guard
    subagents/          sub-agent groups (only bots with the capability get these tools)
      index.ts          lead tools: spawn_subagents, wait_for_subagents, message_subagents; saving + collecting
      member.ts         one member: its agent, inbox, send_message / ask_lead, own files + /shared/
      hub.ts            Group (statuses, mailboxes, shared folder, wake-ups) and GroupHub (one per run segment)
  middleware/
    parallel-tools.ts   at most N tool calls at once (LangChain already runs a step's calls in parallel)
    hide-tools.ts       hides Deep Agents' built-in `task` sub-agent from every bot
    tool-errors.ts      failed tool call -> message (bot and sub-agents)
```

## Add a domain bot

1. Role id in `apps/backend/src/modules/bots/roles.ts` (`ROLE_IDS`) and its label/icon in `apps/web/src/features/bots/roles.ts`.
2. A spec: `domains/<id>.ts`, or `domains/<id>/` when it has several prompts or its own tools. Fill `instructions`
   (short: it is sent every step), `defaults`, `recommended` (catalog ids from `modules/integrations/catalog/skills.ts` and
   `modules/integrations/catalog/mcp.ts`), and `subagentBrief` if its sub-agents need a playbook.
3. Register it in `domains/index.ts`. The bot form reads defaults from `GET /api/v1/bots/domains`; nothing else changes.
4. Domain-only tools: build them in the spec's folder and add them in `agent.ts` from the spec (keep `agent.ts` generic).

## Rules that were verified

- **Web tools** call Tavily's REST API directly (the @langchain/tavily 1.2 wrapper lacks `fast` depth, dates and
  extract `chunks_per_source`). Names match Tavily's own MCP tools, so the Tavily skills (`tavily-ai/skills:
  tavily-search`, `tavily-research`, in the skills catalog) work unchanged. Every bot, sub-agent and background task
  gets all four tools; `tavily_research` (Tavily's research agent, up to 250 credits) exists only in a run the user
  started with `/deep-research` (chat/commands.ts). Research is paid for once per thread and request: the Tavily
  request id is saved in `research_task` before polling (a retry resumes it), and the finished report is saved as a
  markdown file (R2 + chat_file) before the model sees it, inline only up to 60,000 characters (below Deep Agents'
  80,000-character eviction), with its file id so `read_document` can re-read it later (web/research-run.ts).  There are no Tavily-specific spend caps; the model, tool-call and token limits still apply. Tool descriptions carry Tavily's best
  practices (advanced depth, 10 results, one focused query per part, extract before citing). Reference copies of
  Tavily's skills are in `.agents/skills/tavily-*`.
- **Parallel tools**: ToolNode runs a step's tool calls with Promise.all; the middleware queues beyond the bot's
  limit. A Worker keeps at most 6 outgoing connections open, so beyond 6 network calls queue in the runtime anyway.
- **Sub-agent groups**: members are built with LangChain `createAgent` + Deep Agents filesystem and skills
  middleware (not `createDeepAgent`, which always adds a `task` sub-agent, so they cannot nest). Each gets a clean
  context (shared goal + own task + background), its own files, the group's `/shared/` folder, web tools, and exactly
  the skills and apps the lead assigns from everything the user installed. Never the computer, never ask_user, and only
  an app's read-only tools (tools matching the catalog's `approval` pattern stay with the lead, where the chat asks).
- **Communication**: members `send_message` to "lead", another member or "all" (messages are added to the
  recipient's conversation before its next model call), and `ask_lead` (waits up to 5 min for the answer). The lead
  waits inside spawn_subagents / wait_for_subagents and is woken as soon as a member writes to it; it answers with
  `message_subagents`. While a group runs, the lead cannot use anything that pauses the run (approval tools, ask_user,
  wait_for) or start a second group (`createGroupGuardMiddleware`): a pause would end the run segment and the group.
- **When a group ends**: every member's files and the shared folder are saved in the lead's workspace under
  `subagents/<group>/<member>/` and `subagents/<group>/shared/`: the bot's folder on the computer when it is on
  (`~/subagents/...`), otherwise the bot's own `/subagents/` route (StateBackend, written through the bot's
  CompositeBackend so its file tools see them). Nothing deletes them; the lead decides. Then the reports go to the
  lead and the group is removed from the hub. If the lead ends its turn mid-group, the workflow waits for the group
  and continues the run with its results (files then go to the computer, or inline in that message).
- Limits: 6 members at a time, 60 steps and 8 min each, a group ends within 14 min and a minute before the run
  segment's limit. Members' token use is added to `agent_usage`. Live status goes to the chat as `tool.progress`
  events under the lead's current spawn/wait call (not stored).
- Verified on the Worker runtime: domain defaults on create, 21 sub-agents refused, an assistant bot sees neither
  `spawn_subagents` nor `task`, a research bot ran 2 sub-agents in parallel with live status and cited reports, and
  both the lead's and the sub-agents' usage rows were recorded. Group communication: a member's ask_lead woke the
  lead mid-group, the lead answered with message_subagents and kept waiting, one member read data another wrote to
  /shared/, files were saved to `/subagents/<group>/...` (computer off) and to `~/subagents/<group>/...` on a real VM
  (computer on), and the group closed after handing back its reports.
