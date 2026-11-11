import type { NodeKind } from "../workflows/graph/schema";

/** One setting of a block, as the builder's settings panel shows it: what it is, its helper text, an example. */
export type FieldGuide = { name: string; help: string; example?: string; required?: boolean };

export type BlockGuide = {
  kind: NodeKind;
  /** What the user sees it called in the library. */
  title: string;
  group: "Triggers" | "Actions" | "AI" | "Logic";
  /** When to use it, in one or two sentences. */
  use: string;
  fields: FieldGuide[];
  /** A complete, valid `config` for add_block (copy it, then change the values). */
  example: Record<string, unknown>;
  /** How later blocks read what it produced ({{steps.<id>.…}}). */
  output: string;
  /** Rules, limits and mistakes to avoid. */
  rules: string[];
  /** Which connection names leave it (branch), when it has more than one output. */
  branches?: string;
};

const ref = "Add data from earlier steps as {{steps.<blockId>.output.<field>}}.";

/**
 * Everything the assistant needs to know about every block, written from the builder's own settings panels (their
 * labels and helper texts). block-guide.check.ts keeps the setting names in step with the real schemas.
 */
export const BLOCK_GUIDE: BlockGuide[] = [
  {
    kind: "trigger.manual",
    title: "Run by hand",
    group: "Triggers",
    use: "Starts the workflow when the user clicks Run, or when a bot runs it. Optional form fields become the inputs.",
    fields: [
      {
        name: "fields",
        help: "The form shown before a run: a list of {key, label, type: text|number|yes_no|list, required, help?}. The key is how later blocks read it.",
        example: '[{"key":"email","label":"Customer email","type":"text","required":true}]',
      },
    ],
    example: { fields: [{ key: "email", label: "Customer email", type: "text", required: true }] },
    output: "{{trigger.inputs.<key>}} for each form field.",
    rules: ["A workflow has exactly one trigger.", "A bot can only run a workflow that starts with this trigger."],
  },
  {
    kind: "trigger.schedule",
    title: "Schedule",
    group: "Triggers",
    use: "Starts the workflow by itself on a timetable.",
    fields: [
      { name: "mode", help: "every | once | daily | weekly | monthly.", example: "daily", required: true },
      { name: "every", help: "With mode every: how many units between runs (at least 5 minutes in all).", example: "2" },
      { name: "unit", help: "With mode every: minutes | hours | days | weeks.", example: "hours" },
      { name: "at", help: "Time of day as HH:MM (daily, weekly, monthly, once).", example: "09:00" },
      { name: "date", help: "With mode once: the date, YYYY-MM-DD.", example: "2026-12-01" },
      { name: "days", help: "With mode weekly: weekdays as numbers, 0 = Sunday.", example: "[1,3,5]" },
      { name: "dayOfMonth", help: "With mode monthly: 1 to 31.", example: "1" },
      { name: "timezone", help: "Your city's zone.", example: "Asia/Dhaka" },
    ],
    example: { mode: "daily", at: "09:00", days: [1], dayOfMonth: 1, every: 1, unit: "hours", timezone: "UTC" },
    output: "{{trigger.scheduledAt}} (when it started).",
    rules: ["The shortest repeat is every 5 minutes.", "Always set a timezone: without one the time means UTC."],
  },
  {
    kind: "trigger.webhook",
    title: "Webhook",
    group: "Triggers",
    use: "Starts the workflow when another service calls its secret URL (the URL is created when the user turns the workflow on).",
    fields: [
      { name: "auth", help: "none | header | hmac. The URL is secret either way; a header or signature means a leaked URL alone is not enough.", example: "header" },
      { name: "secretName", help: "The name of the secret (Secrets page) that holds the shared key. Never the key itself.", example: "HOOK_SECRET" },
      { name: "headerName", help: "With auth header: the header the sender puts the secret in.", example: "x-webhook-secret" },
      { name: "signatureHeader", help: "With auth hmac: where the sender puts its signature (Stripe: Stripe-Signature, GitHub: X-Hub-Signature-256).", example: "x-hub-signature-256" },
      { name: "signaturePrefix", help: "With auth hmac: text before the signature, e.g. sha256= for GitHub. Empty if none.", example: "sha256=" },
      { name: "ipAllowlist", help: "One address or IPv4 range per entry. Empty allows any sender.", example: '["203.0.113.0/24"]' },
    ],
    example: { auth: "none", headerName: "x-webhook-secret", signatureHeader: "x-signature", signaturePrefix: "sha256=", ipAllowlist: [] },
    output: "{{trigger.body.<field>}} (the JSON the caller sent), {{trigger.headers}}.",
    rules: ["header and hmac need secretName, or the workflow cannot be turned on.", "The webhook URL is shown to the user once; you never see it."],
  },
  {
    kind: "trigger.app",
    title: "App event",
    group: "Triggers",
    use: "Starts the workflow when something happens in a connected app (a new Gmail message, a Slack message, a GitHub push…).",
    fields: [
      { name: "toolkit", help: "The app, e.g. gmail (from find_apps).", example: "gmail", required: true },
      { name: "trigger", help: "The event slug from find_app_events (never invent one).", example: "GMAIL_NEW_GMAIL_MESSAGE", required: true },
      { name: "config", help: "The event's own settings (see get_event_details): what to watch, how often.", example: '{"labelIds":"INBOX"}' },
    ],
    example: { toolkit: "gmail", trigger: "GMAIL_NEW_GMAIL_MESSAGE", config: {} },
    output: "{{trigger.data.<field>}} (what the event carries; see get_event_details → payload).",
    rules: ["The user must connect the app before the workflow can be turned on (request_app_connections).", "Don't use an event whose app action this workflow also triggers: it would start itself."],
  },
  {
    kind: "action.app",
    title: "App action",
    group: "Actions",
    use: "Does one thing in a connected app, as the user (send an email, read rows, post a message…).",
    fields: [
      { name: "toolkit", help: "The app slug.", example: "gmail", required: true },
      { name: "tool", help: "The action slug from find_tools / find_app_actions. Never invent one.", example: "GMAIL_FETCH_EMAILS", required: true },
      { name: "version", help: "The action's pinned version, copied from the search result.", example: "20261105_00" },
      { name: "arguments", help: `The action's inputs (see get_action_details for each field, its type and helper text). Numbers and yes/no may be typed as text. ${ref}`, example: '{"max_results":10,"include_payload":false}' },
    ],
    example: { toolkit: "gmail", tool: "GMAIL_FETCH_EMAILS", version: "20261105_00", arguments: { max_results: 10 } },
    output: "{{steps.<id>.output.<field>}}: what the app returns (try_action or a test run shows the real fields).",
    rules: ["Fill every required input; leave optional ones out.", "Send/post/delete actions change real data: never test them unless the user asked.", "connectedAccountId is chosen by the user in the builder; leave it out."],
  },
  {
    kind: "action.http",
    title: "HTTP request",
    group: "Actions",
    use: "Calls any API or website that is not an app.",
    fields: [
      { name: "method", help: "GET reads, POST creates, PUT or PATCH updates, DELETE removes.", example: "GET", required: true },
      { name: "url", help: `The full address from the API's docs, starting with https://. ${ref}`, example: "https://api.example.com/v1/orders?status=open", required: true },
      { name: "query", help: "Query parameters: a list of {name, value}.", example: '[{"name":"limit","value":"50"}]' },
      { name: "auth", help: "{type: none|bearer|basic|api_key, token: '{{secrets.NAME}}', username, headerName}. The key itself is kept on the Secrets page.", example: '{"type":"bearer","token":"{{secrets.STRIPE_KEY}}"}' },
      { name: "headers", help: "Extra headers: a list of {name, value}.", example: '[{"name":"Accept","value":"application/json"}]' },
      { name: "body", help: "{type: none|json|text|form, value}. Use json for most APIs.", example: '{"type":"json","value":"{\\"email\\":\\"{{trigger.inputs.email}}\\"}"}' },
      { name: "pagination", help: "{mode: none|page|cursor|next_url, param, start, itemsPath, nextPath, maxPages ≤ 10}. The path to the list in each response, e.g. data or results.items.", example: '{"mode":"page","param":"page","start":1,"itemsPath":"data","maxPages":3}' },
      { name: "timeoutSeconds", help: "How long to wait for an answer.", example: "15" },
      { name: "expect", help: "json | text: what the answer is.", example: "json" },
    ],
    example: { method: "GET", url: "https://api.example.com/v1/orders", query: [], auth: { type: "none", token: "", username: "", headerName: "X-API-Key" }, headers: [], body: { type: "none", value: "" }, timeoutSeconds: 15, expect: "json" },
    output: "{{steps.<id>.output.status}}, .headers, .body (the answer); with pagination also .items (every page's items).",
    rules: ["Secrets go only in auth, headers or the body, as {{secrets.NAME}}: never type a real key.", "Private addresses (localhost, 10.x, 192.168.x) are refused."],
  },
  {
    kind: "action.code",
    title: "Code",
    group: "Actions",
    use: "Runs a few lines of JavaScript when no other block can do the job.",
    fields: [
      { name: "code", help: "The body of an async function: read input.<name>, use await, console.log for notes, and return the result. Node.js, no secrets.", example: "return { total: input.orders.length };", required: true },
      { name: "inputs", help: "What the code can read: a list of {key, value}. Values may hold {{references}}, never secrets.", example: '[{"key":"orders","value":"{{steps.http_1.output.items}}"}]' },
      { name: "timeoutSeconds", help: "It runs in a new sandbox each time and is stopped at this limit (1 to 120). The seconds count toward the daily sandbox time.", example: "30" },
    ],
    example: { code: "return { total: input.orders.length };", inputs: [{ key: "orders", value: "{{steps.http_1.output.items}}" }], timeoutSeconds: 30 },
    output: "{{steps.<id>.output.result}}: whatever the code returns.",
    rules: ["Prefer Set fields, Formatter or List tools when they can do it: they are faster and free.", "Output is cut at 64 KB."],
  },
  {
    kind: "ai.bot",
    title: "Ask a bot",
    group: "AI",
    use: "A model summarises, classifies, writes or decides. 'normal' is a plain model (pick modelId); 'bot' is one of the user's bots with its memory.",
    fields: [
      { name: "agent", help: "normal (just the chosen model) | bot (one of the user's bots).", example: "normal", required: true },
      { name: "modelId", help: "With normal: a model id from the catalog.", example: "anthropic/claude-sonnet-4.6" },
      { name: "botId", help: "With bot: one of the user's bots (list_bots).", example: "bot_123" },
      { name: "prompt", help: `What it should do. ${ref} Data from apps is marked as data, so text inside an email cannot give the bot orders.`, example: "Summarize this email in 2 sentences and say if it needs a reply today: {{loop.item.subject}} — {{loop.item.preview.body}}", required: true },
      { name: "output", help: "text | structured (exactly the fields you list in schema) | json (free JSON; say in the prompt which fields).", example: "structured" },
      { name: "schema", help: "With structured: the answer's fields, a list of {name, type: text|number|boolean|list|enum, description, choices}.", example: '[{"name":"urgent","type":"boolean","description":"true if it needs an answer today","choices":[]}]' },
      { name: "useApps", help: "With bot: let it read the bot's connected apps (read only).", example: "false" },
    ],
    example: { agent: "normal", modelId: "anthropic/claude-sonnet-4.6", prompt: "Summarize: {{loop.item.subject}}", output: "text", schema: [], useApps: false, files: [] },
    output: "{{steps.<id>.output.text}} for text; {{steps.<id>.output.json.<field>}} for structured or json.",
    rules: ["It cannot send or change anything: put an app action after it to act on the answer.", "Prefer structured when a later If/Switch needs a field."],
  },
  {
    kind: "ai.decide",
    title: "Decide (Jev)",
    group: "AI",
    use: "A typed decision instead of text: yes/no probability, pick one label, or a score. Best for routing, triage and filtering.",
    fields: [
      { name: "model", help: "Leave jev-latest.", example: "jev-latest" },
      { name: "state", help: "What the questions are about: add the email, message or record from earlier steps. It is sent as data, so text inside it cannot change the questions.", example: "{{loop.item.subject}} {{loop.item.preview.body}}", required: true },
      { name: "questions", help: "A list of {id, type: noul|choice|score, instructions, yes?, no?, choices?[{label, description}], levels?[]}.", example: '[{"id":"urgent","type":"noul","instructions":"Does this email need an answer today?","choices":[],"levels":[]}]', required: true },
    ],
    example: { model: "jev-latest", state: "{{loop.item.subject}}", questions: [{ id: "urgent", type: "noul", instructions: "Does this need an answer today?", choices: [], levels: [] }] },
    output: "{{steps.<id>.output.answers.<question>.noul}} (0–1 probability of yes), .choice (the label), .score (0–1), .confidence.",
    rules: ["Branch with an If using ranges (noul gt 0.7, score lt 0.4), never equals."],
  },
  {
    kind: "logic.if",
    title: "If / else",
    group: "Logic",
    use: "Takes one of two paths.",
    fields: [
      { name: "combine", help: "all (every condition must hold) | any.", example: "all" },
      { name: "conditions", help: "A list of {left, op, right, caseSensitive?}. left and right can hold references. ops: equals, not_equals, contains, not_contains, starts_with, ends_with, gt, gte, lt, lte, exists, not_exists, is_empty, is_not_empty, length_equals, length_gt, length_lt, date_before, date_after, date_equals, is_true, is_false.", example: '[{"left":"{{steps.gmail_1.output.messages.0.subject}}","op":"contains","right":"Invoice"}]', required: true },
      { name: "groups", help: "Groups of conditions, each counted as one: A and (B or C).", example: "[]" },
    ],
    example: { combine: "all", conditions: [{ left: "{{steps.ai_1.output.json.urgent}}", op: "is_true", right: "" }], groups: [] },
    output: "Nothing to read; it chooses the path.",
    branches: "Connect with branch \"true\" and branch \"false\".",
    rules: ["One connection per branch is enough; an unused branch simply ends."],
  },
  {
    kind: "logic.filter",
    title: "Filter",
    group: "Logic",
    use: "Continues only when the conditions match; otherwise this path stops quietly.",
    fields: [
      { name: "combine", help: "all | any.", example: "all" },
      { name: "conditions", help: "Same as the If block: a list of {left, op, right}.", example: '[{"left":"{{trigger.data.sender}}","op":"contains","right":"@acme.com"}]', required: true },
      { name: "groups", help: "Groups of conditions.", example: "[]" },
    ],
    example: { combine: "all", conditions: [{ left: "{{trigger.data.sender}}", op: "contains", right: "@acme.com" }], groups: [] },
    output: "Nothing to read.",
    rules: ["Use If instead when the other path must do something too."],
  },
  {
    kind: "logic.switch",
    title: "Switch",
    group: "Logic",
    use: "Takes one of several paths by rules (the first rule that matches).",
    fields: [
      { name: "rules", help: "A list of {id, label, combine, conditions}. The id names the branch.", example: '[{"id":"sales","label":"Sales","combine":"all","conditions":[{"left":"{{steps.ai_1.output.json.team}}","op":"equals","right":"sales"}]}]', required: true },
      { name: "otherwise", help: "true adds an 'otherwise' output for everything no rule matched.", example: "true" },
    ],
    example: { rules: [{ id: "sales", label: "Sales", combine: "all", conditions: [{ left: "{{steps.ai_1.output.json.team}}", op: "equals", right: "sales" }] }], otherwise: true },
    output: "Nothing to read.",
    branches: "Connect with branch = a rule's id, or \"otherwise\".",
    rules: ["Rule ids are short and unique."],
  },
  {
    kind: "logic.delay",
    title: "Delay",
    group: "Logic",
    use: "Waits before the next step. Waiting costs nothing.",
    fields: [
      { name: "mode", help: "for (a length of time) | until (a date) | next (the next chosen day and time).", example: "for", required: true },
      { name: "amount", help: "With for: a whole number, e.g. 30.", example: "30" },
      { name: "unit", help: "With for: seconds | minutes | hours | days.", example: "minutes" },
      { name: "until", help: "With until: a date from an earlier step, or one like 2026-12-01 09:00 (add +06:00 for your zone; without it, UTC). A time already past goes on at once.", example: "2026-12-01 09:00" },
      { name: "days", help: "With next: weekdays, 0 = Sunday.", example: "[1]" },
      { name: "at", help: "With next: HH:MM.", example: "09:00" },
      { name: "timezone", help: "Your city's zone.", example: "Europe/London" },
    ],
    example: { mode: "for", amount: 5, unit: "minutes", until: "", days: [1], at: "09:00", timezone: "UTC" },
    output: "Nothing to read.",
    rules: ["All delays together (a delay inside a For each counts per item) are at most 7 days."],
  },
  {
    kind: "logic.set",
    title: "Set fields",
    group: "Logic",
    use: "Shapes data for later steps: builds an object from named fields.",
    fields: [
      { name: "fields", help: "A list of {key, value, type: text|number|yes_no|list|object}. The value can hold references; type says what it becomes.", example: '[{"key":"customerEmail","value":"{{trigger.inputs.email}}","type":"text"}]', required: true },
      { name: "base", help: "An object from an earlier step: the output is a copy of it with these fields added or replaced. Empty: only these fields.", example: "{{steps.http_1.output.body}}" },
    ],
    example: { fields: [{ key: "customerEmail", value: "{{trigger.inputs.email}}", type: "text" }], base: "" },
    output: "{{steps.<id>.output.<key>}} for each field.",
    rules: ["At most 20 fields.", "Secrets are not allowed here."],
  },
  {
    kind: "logic.return",
    title: "Return",
    group: "Logic",
    use: "The workflow's answer: what a bot that ran it gets back. Put it last (after a For each's done output).",
    fields: [
      { name: "fields", help: "The same list as Set fields: {key, value, type}. These fields are the result.", example: '[{"key":"summary","value":"{{steps.ai_1.output.text}}","type":"text"}]', required: true },
      { name: "base", help: "Optional object to start from.", example: "" },
    ],
    example: { fields: [{ key: "summary", value: "{{steps.ai_1.output.text}}", type: "text" }], base: "" },
    output: "The bot's run_workflow result.",
    rules: ["Nothing comes after it: it has no output connection."],
  },
  {
    kind: "logic.format",
    title: "Formatter",
    group: "Logic",
    use: "No-code text, number, date and list changes.",
    fields: [
      { name: "operation", help: "uppercase, lowercase, capitalize, trim, replace, split, truncate, extract_email, extract_url, extract_number, round, add, subtract, multiply, divide, format_number, format_date, add_time, to_timezone, join, first, last, count, unique.", example: "extract_email", required: true },
      { name: "input", help: `The value to change. ${ref}`, example: "{{loop.item.sender}}", required: true },
      { name: "options", help: "The operation's settings, all as text: find/replace, separator, length, decimals, value, timezone, dateStyle, locale, amount/unit.", example: '{"separator":", "}' },
    ],
    example: { operation: "extract_email", input: "{{loop.item.sender}}", options: {} },
    output: "{{steps.<id>.output.result}}.",
    rules: [],
  },
  {
    kind: "logic.merge",
    title: "Merge",
    group: "Logic",
    use: "Brings paths or values together.",
    fields: [
      { name: "mode", help: "append (lists one after another) | combine (objects into one) | by_key (join lists on a key) | first (the first that has a value).", example: "append", required: true },
      { name: "inputs", help: "2 to 5 values or paths.", example: '["{{steps.a.output.items}}","{{steps.b.output.items}}"]' },
      { name: "key", help: "With by_key: for example id or email (a dot reaches inside: customer.id).", example: "email" },
    ],
    example: { mode: "append", inputs: ["{{steps.a.output.items}}", "{{steps.b.output.items}}"], key: "" },
    output: "{{steps.<id>.output.items}} (append, by_key) or .result (combine, first).",
    rules: [],
  },
  {
    kind: "logic.list",
    title: "List tools",
    group: "Logic",
    use: "One operation on a list: split out, pick a field, sum, sort, group…",
    fields: [
      { name: "operation", help: "split_out, pluck, sum, average, min, max, count, sort, group_by, unique, first_n.", example: "pluck", required: true },
      { name: "input", help: "Pick a list with + (e.g. the rows of a sheet).", example: "{{steps.gmail_1.output.messages}}", required: true },
      { name: "field", help: "For example email or price; a dot reaches inside (address.city). Empty uses the item itself.", example: "subject" },
      { name: "order", help: "With sort: asc | desc.", example: "asc" },
      { name: "amount", help: "With first_n: how many.", example: "5" },
    ],
    example: { operation: "pluck", input: "{{steps.gmail_1.output.messages}}", field: "subject", order: "asc", amount: 5 },
    output: "{{steps.<id>.output.items}} (lists) or .result (single values).",
    rules: [],
  },
  {
    kind: "logic.loop",
    title: "For each",
    group: "Logic",
    use: "Repeats the next steps for every item of a list.",
    fields: [
      { name: "items", help: "Pick a list from an earlier step. Every block connected after this one runs once per item, one item after another.", example: "{{steps.gmail_1.output.messages}}", required: true },
      { name: "max", help: "Only the first this many items are used (up to 100).", example: "50" },
    ],
    example: { items: "{{steps.gmail_1.output.messages}}", max: 50 },
    output: "Inside: {{loop.item}} ({{loop.item.subject}}), {{loop.index}} (0, 1, 2…), {{loop.count}}. After the loop: {{steps.<id>.output.results}}.",
    branches: "Plain connection (no branch) = runs once per item. Branch \"done\" = runs once after every item.",
    rules: ["One For each per workflow.", "It needs at least one block after it.", "items must be a list, or the block fails."],
  },
  {
    kind: "logic.approval",
    title: "Ask me first",
    group: "Logic",
    use: "Pauses until the user approves.",
    fields: [
      { name: "message", help: `Shown when the run reaches this block. ${ref}`, example: "Send this reply to {{loop.item.sender}}?", required: true },
      { name: "timeoutHours", help: "With no answer by then, this block fails or declines (1 to 168 hours).", example: "24" },
      { name: "onTimeout", help: "fail | decline.", example: "fail" },
    ],
    example: { message: "Send this reply?", timeoutHours: 24, onTimeout: "fail" },
    output: "Nothing to read.",
    rules: ["A declined path stops there."],
  },
];

export const guideOf = (kind: string) => BLOCK_GUIDE.find((b) => b.kind === kind);
