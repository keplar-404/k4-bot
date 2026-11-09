# Decisions

Product and architecture decisions that shape the code. Each records what was decided and why, so later changes
start from the reasoning rather than re-asking.

## Product

| # | Decision | Why |
|---|---|---|
| P1 | **One platform for bots and automations** ("Grok and Zapier combined"): users build workflows, share them with bots, and bots build and run workflows | The product goal |
| P2 | Bots use the user's **connected apps** (Composio), enabled per bot, read and write separately | Bots must act, but only where the user allows |
| P3 | **Permission modes** in the prompt bar: Allow all · Plan · Ask (default Ask). Plan asks to switch with a button in the chat | Users choose how much autonomy each conversation has |
| P4 | A bot may **create and run workflows**, within the mode and caps | Bots automate for the user |
| P5 | **Secrets** are entered in a secure form, encrypted in the database, and never seen by the bot | Keys for workflows without leaking them to models |
| P6 | **Per-block retry** settings (tries, delay, backoff) and continue-on-error | n8n-style control over failures |
| P7 | The **HTTP request block**, with SSRF protection | Reach services Composio lacks |
| P8 | Each bot has its **own PC** (Linux account, workspace, browser) on the user's single E2B desktop | Real computer use, isolated per bot, one bill per user |
| P9 | "Ask a bot" workflow step is **read-only** | An email cannot make a workflow act through a bot; the next block decides |
| P10 | **Scheduled tasks post into the bot's chat** instead of running as workflows | Tasks need the full bot (all tools, approvals, conversation); the user watches them live |

## Engineering

| # | Decision | Why |
|---|---|---|
| E1 | ≤ 100 lines per file, feature folders, pragmatic single responsibility | Small, reviewable units |
| E2 | Never trust the frontend: zod on every input, user-scoped queries, 404 for others' ids | Security baseline |
| E3 | Long work runs in **Cloudflare Workflows**, never in a request | Survives deploys; waiting is free; retries are durable |
| E4 | One **Durable Object per thread / user / bot / workflow** | Ordered events and sockets per entity without a separate pub/sub |
| E5 | **Caps that deletes cannot reset** (usage rows outlive chats) | No cost blow-ups, even by a bot |
| E6 | Plan mode is an **allow-list** | New tools are blocked until reviewed |
| E7 | Composio data (actions, inputs, events) is always **read from Composio**, never hand-written | The same source as Composio's docs |
| E8 | Prompts live in one folder (`apps/backend/src/prompts`) | Easy to review and edit |
| E9 | Workflow graphs are JSON validated by one shared zod schema; old graphs are read with defaults | One definition for web and server; no data migrations for new settings |
| E10 | App events through **one signed endpoint**, verified by our own HMAC check | Composio's SDK accepts only trigger messages; connection events need the same protection |
