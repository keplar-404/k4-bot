# Agent tools

Every tool a chat bot can get, grouped by family. Which ones a bot actually receives depends on its settings, the
server configuration (missing keys turn a family off) and the thread's permission mode.

Legend: **R** = read-only (offered in Plan mode), **A** = asks for approval in Ask mode, **AA** = always asks.

## Planning and the user

| Tool | Mode | What it does |
|---|---|---|
| `write_todos` | R | Keeps a todo list for multi-step work (required for 3+ steps; a guard reminds the bot) |
| `ask_user` | R | Asks the user a question and waits durably for the answer |
| `wait_for` | R | Sleeps and comes back later (up to 7 days) |
| `request_mode_switch` | R | In Plan mode, asks the user to switch mode with a button in the chat |
| `update_memory`, `update_user_preferences` | | Rewrite the bot's memory or the user's preferences |

## Web research (Tavily, needs `TAVILY_API_KEY`)

| Tool | Mode | What it does |
|---|---|---|
| `tavily_search` | R | Web search |
| `tavily_extract` | R | Read the content of given URLs |
| `tavily_map`, `tavily_crawl` | R | Map or crawl a site |
| `tavily_research` | R | Tavily's research agent (used by `/deep-research`) |

## Files (needs the R2 binding `FILES`)

| Tool | Mode | What it does |
|---|---|---|
| `read_document` | R | Reads PDFs, Office documents, CSV, Markdown, JSON, HTML, text, page by page. Scanned pages go to the model as pictures (vision models) or to paid OCR (Mistral, capped per day) |
| `read_pdf_advanced` | R | Deeper PDF reading for complex layouts |
| `view_image` | R | Shows a stored image to a vision model |
| `generate_image` | | Creates an image (OpenRouter image model, capped per day) and saves it |
| `share_file`, `copy_to_computer` | | Moves files between the Files store and the bot's computer |
| `ls`, `read_file`, `glob`, `grep` (R), `write_file`, `edit_file` (A) | | Deep Agents' file tools: a virtual filesystem, or the bot's home on the computer |

## Computer (needs `E2B_API_KEY`) — see [Computer and sandboxes](computer-and-sandboxes.md)

| Tool | Mode | What it does |
|---|---|---|
| `turn_on_computer` | AA | Wakes the user's desktop (costs computer minutes) |
| `computer` | | Screenshot, click, type, key presses, scroll, open URLs, run shell commands as the bot's own Linux user |
| `turn_off_computer` | | Pauses it (asks only when another bot is working or the user holds the mouse) |

## Code sandbox (coding role) — see [Computer and sandboxes](computer-and-sandboxes.md)

`sandbox_start`, `sandbox_stop`, `sandbox_list`, `sandbox_list_all`, `sandbox_read`, `sandbox_search` (R),
`sandbox_write`, `sandbox_edit`, `sandbox_exec`, `sandbox_preview`, `sandbox_delete` (AA).

## Sub-agents and background work

| Tool | What it does |
|---|---|
| `spawn_subagents` | Runs a group of up to N sub-agents in parallel, each with a non-overlapping brief and its own context; they share a group folder |
| `message_subagents`, `wait_for_subagents` | Talk to a running group; wait for it |
| `ask_lead`, `send_message` | Used by the sub-agents themselves |
| `start_background_task`, `update_background_task`, `check_background_task` (R), `list_background_tasks` (R), `cancel_background_task` | Long side work in its own Workflow that outlives the turn; the bot is told when it ends |

## Skills and MCP apps — see [Skills and MCP](skills-and-mcp.md)

Installed skills are offered through Deep Agents' skills middleware (read on demand). MCP server tools are loaded from
the servers the bot may use; read-only ones stay available in Plan mode. The built-in `shadcn` server provides
`shadcn_search_items`, `shadcn_view_items`, `shadcn_get_item_examples`, `shadcn_get_add_command`.

## Connected apps (Composio) — see [Connected apps](connected-apps.md)

| Tool | Mode | What it does |
|---|---|---|
| `app_find_actions` | R | Finds actions of an enabled app by intent |
| `app_action_details` | R | An action's inputs, outputs and version |
| `app_find_events` | R | An app's events (for workflow triggers) |
| `app_read` | R | Runs an action known to be read-only (unknown actions count as writes and are refused) |
| `app_act` | A | Runs any action, if the bot may write in that app; the user sees a one-line summary |

## Workflows — see [Workflows](workflows.md)

| Tool | Mode | What it does |
|---|---|---|
| `list_my_workflows`, `get_workflow`, `workflow_run_status` | R | Workflows shared with the bot or made by it |
| `create_workflow`, `update_workflow` | | Drafts (harmless until turned on); at most a few per bot per day |
| `turn_on_workflow`, `run_workflow` | A | Publish; run one with a manual trigger |
| `pause_workflow` | | Turn off |
| `request_secret` | | Shows a secure form for an API key; the bot only learns "saved as NAME" |

## Scheduled tasks — see [Scheduled tasks](scheduled-tasks.md)

`schedule_task` (A), `list_scheduled_tasks` (R), `change_scheduled_task` (A: pause, resume, delete, reschedule).
