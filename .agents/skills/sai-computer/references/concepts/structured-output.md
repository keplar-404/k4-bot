# Structured output

Advanced. Add options to a message to get typed output, checked results and a record of each step.

A plain message is all most tasks need: Sai does the work and `text` holds its answer. When your code has to use the result, add `options` to the same [`POST /message`](/documentation/api-reference/message) call. Sai still works the same way; the turn also returns a typed result.

## A first example

Ask for the top story on Hacker News as JSON. The only difference from a plain message is `options.output_schema`:

```bash title="Ask for typed output"
curl -s "$SAI_API_URL/v1/agents/message" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Open https://news.ycombinator.com and read the title of the top story.",
    "options": {
      "output_schema": {
        "type": "object",
        "properties": { "title": { "type": "string" } },
        "required": ["title"]
      }
    },
    "wait": false
  }'
```

```python title="Ask for typed output"
from sai import Sai

sai = Sai()
session = sai.sessions.create()
turn = session.send(
    "Open https://news.ycombinator.com and read the title of the top story.",
    output_schema={
        "type": "object",
        "properties": {"title": {"type": "string"}},
        "required": ["title"],
    },
)
print(turn.id)
```

```typescript title="Ask for typed output"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = await sai.sessions.create()
const turn = await session.send(
  'Open https://news.ycombinator.com and read the title of the top story.',
  {
    outputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
  },
)
console.log(turn.id)
```

```go title="Ask for typed output"
import (
	"context"
	"fmt"
	"log"

	sai "github.com/simular-ai/sai-sdk/go"
)

ctx := context.Background()
client, err := sai.New(sai.Options{})
if err != nil {
	log.Fatal(err)
}
session, err := client.Sessions.Create(ctx, nil)
if err != nil {
	log.Fatal(err)
}
turn, err := session.Send(ctx, "Open https://news.ycombinator.com and read the title of the top story.", &sai.SendOptions{
	OutputSchema: map[string]any{
		"type":       "object",
		"properties": map[string]any{"title": map[string]any{"type": "string"}},
		"required":   []string{"title"},
	},
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(turn.ID)
```

```java title="Ask for typed output"
import ai.simular.sai.Sai;
import ai.simular.sai.SendOptions;
import ai.simular.sai.Session;
import ai.simular.sai.Turn;
import java.util.List;
import java.util.Map;

Sai sai = new Sai();
Session session = sai.sessions().create();
Turn turn = session.send(
    "Open https://news.ycombinator.com and read the title of the top story.",
    new SendOptions().outputSchema(Map.of(
        "type", "object",
        "properties", Map.of("title", Map.of("type", "string")),
        "required", List.of("title"))));
System.out.println(turn.id());
```

```csharp title="Ask for typed output"
using Simular.Sai;

var sai = new SaiClient();
var session = await sai.Sessions.CreateAsync();
var turn = await session.SendAsync(
    "Open https://news.ycombinator.com and read the title of the top story.",
    new SendOptions
    {
        OutputSchema = new
        {
            type = "object",
            properties = new { title = new { type = "string" } },
            required = new[] { "title" },
        },
    });
Console.WriteLine(turn.Id);
```

```ruby title="Ask for typed output"
require "sai"

sai = Sai::Client.new
session = sai.sessions.create
turn = session.send(
  "Open https://news.ycombinator.com and read the title of the top story.",
  output_schema: {
    type: "object",
    properties: { title: { type: "string" } },
    required: ["title"]
  }
)
puts turn.id
```

The `202` includes a `turnId`:

```json title="202 Accepted · Message sent"
{
  "sessionId": "cs_01HZY",
  "machineId": "m_7f2a",
  "queued": false,
  "turnId": "turn_abPDn3htwBVxbWOhuLPL"
}
```

Poll [`GET /v1/agents/turns/{turnId}`](/documentation/api-reference/turns) every few seconds until `status` is `succeeded` or `failed`:

```json title="200 OK · Turn record"
{
  "turnId": "turn_abPDn3htwBVxbWOhuLPL",
  "status": "succeeded",
  "output": { "title": "Show HN: A tiny database in 500 lines" },
  "reason_code": null,
  "evidence": [],
  "usage": { "inputTokens": 18450, "outputTokens": 210 }
}
```

`output` matches your schema, so your code can read `output.title` directly. The [curl example](/documentation/examples/curl#get-typed-output) runs this from a shell.

## Advanced options

Everything below is optional and goes inside `options`. An unknown key, or one of these sent next to `message` instead of inside `options`, is a `400`.

| Option             | Type                                              | Default                         | What it does                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output_schema`    | `object` (JSON Schema)                            | none                            | The shape the turn's `output` has to match. At most 32 KB. See [Output](#output).                                                                                                                                      |
| `inputs`           | `{ [name]: string \| number \| boolean }`         | none                            | One value for each `{{name}}` placeholder in `message`, for example a vendor and a month. See [Templates and inputs](#templates-and-inputs).                                                                           |
| `success_criteria` | `string` or `Check[]`                             | none                            | A sentence for a model to judge the result against (at most 4,000 characters), or 1 to 20 checks. A check is an object with `id`, `check` and an optional `returnEvidence`. See [Success criteria](#success-criteria). |
| `idempotency_key`  | `string`                                          | none                            | 1 to 255 characters, unique per account. The same key again returns the earlier turn and sends nothing. See [Idempotency](#idempotency).                                                                               |
| `recordTrajectory` | `boolean`                                         | `false`                         | `true` records a screenshot, the title, the code and the agent's reasoning for each step. See [Trajectory](#trajectory).                                                                                               |
| `thinkingLevel`    | `'off' \| 'low' \| 'medium' \| 'high' \| 'xhigh'` | the account's Thinking strength | How long Sai reasons on this turn. A session that is already working refuses it with `409 session_busy`.                                                                                                               |

`output_schema`, `inputs` or `success_criteria` make the message **structured**. `idempotency_key`, `recordTrajectory` and `thinkingLevel` work on plain messages too.

A fuller example, with every option. The request:

```bash title="Give Sai a task with every option"
curl -s "$SAI_API_URL/v1/agents/message" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Sign in to the {{vendor}} portal and list the invoices dated in {{month}}.",
    "options": {
      "inputs": { "vendor": "Acme", "month": "September 2026" },
      "output_schema": {
        "type": "object",
        "properties": {
          "invoices": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "number": { "type": "string" },
                "date": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
                "total": { "type": "number" }
              },
              "required": ["number", "date", "total"]
            }
          }
        },
        "required": ["invoices"]
      },
      "success_criteria": [
        { "id": "signed_in", "check": "Sai signed in and saw the invoice list." },
        {
          "id": "all_listed",
          "check": "Every invoice dated in the month is in the answer.",
          "returnEvidence": true
        }
      ],
      "idempotency_key": "acme-invoices-2026-09",
      "recordTrajectory": true
    },
    "wait": false
  }'
```

```python title="Give Sai a task with every option"
from sai import Sai

sai = Sai()
session = sai.sessions.create()
turn = session.send(
    "Sign in to the {{vendor}} portal and list the invoices dated in {{month}}.",
    inputs={"vendor": "Acme", "month": "September 2026"},
    output_schema={
        "type": "object",
        "properties": {
            "invoices": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "number": {"type": "string"},
                        "date": {"type": "string", "pattern": r"^\d{4}-\d{2}-\d{2}$"},
                        "total": {"type": "number"},
                    },
                    "required": ["number", "date", "total"],
                },
            }
        },
        "required": ["invoices"],
    },
    success_criteria=[
        {"id": "signed_in", "check": "Sai signed in and saw the invoice list."},
        {
            "id": "all_listed",
            "check": "Every invoice dated in the month is in the answer.",
            "returnEvidence": True,
        },
    ],
    idempotency_key="acme-invoices-2026-09",
    record_trajectory=True,
)
print(turn.id)
```

```typescript title="Give Sai a task with every option"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = await sai.sessions.create()
const turn = await session.send(
  'Sign in to the {{vendor}} portal and list the invoices dated in {{month}}.',
  {
    inputs: { vendor: 'Acme', month: 'September 2026' },
    outputSchema: {
      type: 'object',
      properties: {
        invoices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              number: { type: 'string' },
              date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              total: { type: 'number' },
            },
            required: ['number', 'date', 'total'],
          },
        },
      },
      required: ['invoices'],
    },
    successCriteria: [
      { id: 'signed_in', check: 'Sai signed in and saw the invoice list.' },
      {
        id: 'all_listed',
        check: 'Every invoice dated in the month is in the answer.',
        returnEvidence: true,
      },
    ],
    idempotencyKey: 'acme-invoices-2026-09',
    recordTrajectory: true,
  },
)
console.log(turn.id)
```

```go title="Give Sai a task with every option"
import (
	"context"
	"fmt"
	"log"

	sai "github.com/simular-ai/sai-sdk/go"
)

ctx := context.Background()
client, err := sai.New(sai.Options{})
if err != nil {
	log.Fatal(err)
}
session, err := client.Sessions.Create(ctx, nil)
if err != nil {
	log.Fatal(err)
}
turn, err := session.Send(ctx,
	"Sign in to the {{vendor}} portal and list the invoices dated in {{month}}.",
	&sai.SendOptions{
		Inputs: map[string]any{"vendor": "Acme", "month": "September 2026"},
		OutputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"invoices": map[string]any{
					"type": "array",
					"items": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"number": map[string]any{"type": "string"},
							"date":   map[string]any{"type": "string", "pattern": `^\d{4}-\d{2}-\d{2}$`},
							"total":  map[string]any{"type": "number"},
						},
						"required": []string{"number", "date", "total"},
					},
				},
			},
			"required": []string{"invoices"},
		},
		SuccessCriteria: sai.Checks{
			{ID: "signed_in", Check: "Sai signed in and saw the invoice list."},
			{ID: "all_listed", Check: "Every invoice dated in the month is in the answer.", ReturnEvidence: true},
		},
		IdempotencyKey:   "acme-invoices-2026-09",
		RecordTrajectory: true,
	},
)
if err != nil {
	log.Fatal(err)
}
fmt.Println(turn.ID)
```

```java title="Give Sai a task with every option"
import ai.simular.sai.Check;
import ai.simular.sai.Sai;
import ai.simular.sai.SendOptions;
import ai.simular.sai.Session;
import ai.simular.sai.Turn;
import java.util.List;
import java.util.Map;

Sai sai = new Sai();
Session session = sai.sessions().create();
Turn turn = session.send(
    "Sign in to the {{vendor}} portal and list the invoices dated in {{month}}.",
    new SendOptions()
        .inputs(Map.of("vendor", "Acme", "month", "September 2026"))
        .outputSchema(Map.of(
            "type", "object",
            "properties", Map.of(
                "invoices", Map.of(
                    "type", "array",
                    "items", Map.of(
                        "type", "object",
                        "properties", Map.of(
                            "number", Map.of("type", "string"),
                            "date", Map.of("type", "string", "pattern", "^\\d{4}-\\d{2}-\\d{2}$"),
                            "total", Map.of("type", "number")),
                        "required", List.of("number", "date", "total")))),
            "required", List.of("invoices")))
        .successCriteria(List.of(
            new Check("signed_in", "Sai signed in and saw the invoice list."),
            new Check("all_listed", "Every invoice dated in the month is in the answer.", true)))
        .idempotencyKey("acme-invoices-2026-09")
        .recordTrajectory(true));
System.out.println(turn.id());
```

```csharp title="Give Sai a task with every option"
using Simular.Sai;

var sai = new SaiClient();
var session = await sai.Sessions.CreateAsync();
var turn = await session.SendAsync(
    "Sign in to the {{vendor}} portal and list the invoices dated in {{month}}.",
    new SendOptions
    {
        Inputs = new Dictionary<string, object> { ["vendor"] = "Acme", ["month"] = "September 2026" },
        OutputSchema = new
        {
            type = "object",
            properties = new
            {
                invoices = new
                {
                    type = "array",
                    items = new
                    {
                        type = "object",
                        properties = new
                        {
                            number = new { type = "string" },
                            date = new { type = "string", pattern = @"^\d{4}-\d{2}-\d{2}$" },
                            total = new { type = "number" },
                        },
                        required = new[] { "number", "date", "total" },
                    },
                },
            },
            required = new[] { "invoices" },
        },
        SuccessCriteria = new[]
        {
            new Check("signed_in", "Sai signed in and saw the invoice list."),
            new Check("all_listed", "Every invoice dated in the month is in the answer.", ReturnEvidence: true),
        },
        IdempotencyKey = "acme-invoices-2026-09",
        RecordTrajectory = true,
    });
Console.WriteLine(turn.Id);
```

```ruby title="Give Sai a task with every option"
require "sai"

sai = Sai::Client.new
session = sai.sessions.create
turn = session.send(
  "Sign in to the {{vendor}} portal and list the invoices dated in {{month}}.",
  inputs: { "vendor" => "Acme", "month" => "September 2026" },
  output_schema: {
    type: "object",
    properties: {
      invoices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            number: { type: "string" },
            date: { type: "string", pattern: '^\d{4}-\d{2}-\d{2}$' },
            total: { type: "number" }
          },
          required: %w[number date total]
        }
      }
    },
    required: ["invoices"]
  },
  success_criteria: [
    { id: "signed_in", check: "Sai signed in and saw the invoice list." },
    {
      id: "all_listed",
      check: "Every invoice dated in the month is in the answer.",
      return_evidence: true
    }
  ],
  idempotency_key: "acme-invoices-2026-09",
  record_trajectory: true
)
puts turn.id
```

The `POST` answers `202` at once with the `turnId`. Once the turn has succeeded, [`GET /v1/agents/turns/{turnId}`](/documentation/api-reference/turns) returns its result (shortened here):

```json title="200 OK · Turn record"
{
  "turnId": "turn_vzjz62w7j7jvOilZ6zBL",
  "status": "succeeded",
  "output": {
    "invoices": [
      { "number": "INV-1043", "date": "2026-09-04", "total": 1280.5 },
      { "number": "INV-1051", "date": "2026-09-18", "total": 312 }
    ]
  },
  "reason_code": null,
  "evidence": [
    { "id": "signed_in", "passed": true, "score": 0.97 },
    {
      "id": "all_listed",
      "passed": true,
      "score": 0.91,
      "evidence": "The list filtered to September showed INV-1043 and INV-1051, and both are in the answer."
    }
  ],
  "usage": { "inputTokens": 48210, "outputTokens": 1630 },
  "template": "Sign in to the {{vendor}} portal and list the invoices dated in {{month}}.",
  "inputs": { "vendor": "Acme", "month": "September 2026" }
}
```

The full response is on the [Turns](/documentation/api-reference/turns) page.

## Templates and inputs

Each `{{name}}` in `message` is replaced by `inputs.name` before Sai sees the message. Values are strings, numbers or booleans. Every placeholder needs a value and every input has to be used; otherwise the request fails with `400 invalid_template` and nothing is sent.

Keep the values in `inputs` rather than in the message text, so the same template serves every run. The turn keeps both the template and its inputs.

## Output

With `output_schema`, Sai is asked to state the schema's top-level properties in its final answer. After the turn, a model reads what Sai did and said and writes JSON constrained by your schema. The API validates it against the schema and, on failure, retries with the validator's errors: 3 attempts in all.

When no attempt passes, the turn fails with `output_invalid`, and `raw_answer` and `output_errors` show what Sai said and why it did not match. You never get a partial object.

- The schema is standard JSON Schema, at most 32 KB.
- `pattern` uses RE2 syntax: no lookahead, lookbehind or backreferences. A schema that does not compile fails with `400 invalid_output_schema`.
- Ask for values Sai can see on the screen or state in its answer. For a large table, have Sai save a file on the computer and return its path.

Without `output_schema`, `output` is Sai's final answer as a string.

## Success criteria

`success_criteria` is checked after the output, against the record of the turn (the task, Sai's steps and its final answer). It takes one of two forms:


```ts title="success_criteria types"
success_criteria: string // a sentence, 1 to 4,000 characters
success_criteria: Check[] // 1 to 20 checks

interface Check {
  id: string // letters, digits, _ or -; 1 to 64 characters; names the check in the result
  check: string // a yes/no statement about the result, 1 to 1,000 characters
  returnEvidence?: boolean // default false; true adds one sentence of evidence (one more model call)
}
```

- **A string.** A model decides whether the result meets it. `evidence` holds one entry, with the reason in one or two sentences.

  ```json title="success_criteria as a sentence"
  "success_criteria": "Every invoice dated in the month is listed, with its number, date and total."
  ```

- **A list of checks.** Each check is scored from 0 to 1 (`score`) and passes at 0.5 or above. `evidence` holds one entry per check, with its `id`, `passed` and `score`, plus `evidence` for a check that set `returnEvidence`.

  ```json title="success_criteria as checks"
  "success_criteria": [
    { "id": "signed_in", "check": "Sai signed in and saw the invoice list." },
    { "id": "all_listed", "check": "Every invoice dated in the month is in the answer.", "returnEvidence": true }
  ]
  ```

A failed check makes the turn `failed` with `criteria_not_met`. When the checks could not run at all, the reason is `criteria_unchecked`.

The checks read the turn's record, which includes text Sai read on the screen, so a page can influence them. Treat a pass as evidence, and verify high-stakes results in your own system.

## Status

| `status`      | Meaning                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `running`     | Sai is working, or the computer is starting.                                          |
| `needs_input` | An approval is pending. See [Approvals](/documentation/concepts/approvals).           |
| `finalizing`  | The turn is over. The output and checks are being worked out, usually within seconds. |
| `succeeded`   | `output` is ready and every check passed.                                             |
| `failed`      | `reason_code` says why.                                                               |

| `reason_code`         | Meaning                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `agent_error`         | Sai's turn failed, or it finished without an answer. See `error_code`.         |
| `aborted`             | Stopped by an abort request before it answered.                                |
| `output_invalid`      | No answer matched `output_schema` after 3 attempts.                            |
| `criteria_not_met`    | At least one check failed.                                                     |
| `criteria_unchecked`  | The checks could not be run.                                                   |
| `machine_unavailable` | The computer failed to start.                                                  |
| `not_started`         | The computer was ready, but Sai did not pick the message up within 10 minutes. |

`agent_error` means the task itself failed; `criteria_not_met` means it finished but the result is wrong. Handle them differently.

## Sessions

A structured message goes where a plain one would: to the session you pass as `sessionId`, or to your API conversation on that computer. So it can build on what came before; for example, sign in with a plain message, then send a structured step in the same session, then ask a plain follow-up about its result.

When a result should not depend on earlier conversation, start a fresh session first with [`POST /new-session`](/documentation/api-reference/new-session). Most of what a later step needs is on the computer (a signed-in browser, downloaded files), so a new session loses little.

A session runs one turn at a time. A plain message sent while Sai is busy joins the running turn and gets that turn's `turnId`. A structured message can't join a turn that was started for something else, so it gets `409 session_busy`; send it again when the session is idle. To run tasks in parallel, use separate computers.

## Idempotency

`idempotency_key` is unique per account. Sending the same key again returns `200` with the earlier turn and `"idempotent_replay": true`, and sends nothing to Sai. Use one key per unit of work (one invoice, one claim), so a retry after a crash does not do the work twice.

## Trajectory

Set `recordTrajectory: true` to record each step of the turn: its title, the code Sai ran, Sai's reason for it, and a screenshot. Read them with [`GET /v1/agents/turns/{turnId}/trajectory`](/documentation/api-reference/turns#trajectory). It is off by default, and is decided when the turn starts: sent to a busy session whose running turn does not record, it gets `409 session_busy`.

## Usage

`usage` counts Sai's model calls in the turn. The calls made after the turn (output extraction, checks, evidence) are billed to your account but not counted in `usage`.
