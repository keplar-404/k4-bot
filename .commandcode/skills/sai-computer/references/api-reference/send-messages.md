# Send a message

POST /v1/agents/message

Sends a task to Sai on one computer. Returns at once with `wait: false`, or streams the turn with `wait: true`.

Every message gets a `turnId`; read the turn's result with [`GET /v1/agents/turns/{turnId}`](/documentation/api-reference/turns). For typed output and checked results, add [`options`](#options-advanced).

## Request

```bash title="Give Sai a task"
curl -s "$SAI_API_URL/v1/agents/message" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Open Notepad, type hello, save it to the desktop as hello.txt",
    "machineId": "m_7f2a",
    "wait": false,
    "attachments": [
      {
        "path": "uploads/report-1790000000000.pdf",
        "name": "report-1790000000000.pdf",
        "mime": "application/pdf",
        "size": 48213,
        "fileId": "f_3kd9"
      }
    ]
  }'
```

```python title="Give Sai a task"
from sai import Sai

sai = Sai()
report = sai.files.upload("report.pdf")  # attachments take what upload returns
session = sai.sessions.create(machine="m_7f2a")
turn = session.send(
    "Open Notepad, type hello, save it to the desktop as hello.txt",
    attachments=[report],
)
print(turn.id)
```

```typescript title="Give Sai a task"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const report = await sai.files.upload('report.pdf') // attachments take what upload returns
const session = await sai.sessions.create({ machine: 'm_7f2a' })
const turn = await session.send('Open Notepad, type hello, save it to the desktop as hello.txt', {
  attachments: [report],
})
console.log(turn.id)
```

```go title="Give Sai a task"
import (
	"context"
	"fmt"
	"log"
	"os"

	sai "github.com/simular-ai/sai-sdk/go"
)

ctx := context.Background()
client, err := sai.New(sai.Options{})
if err != nil {
	log.Fatal(err)
}
f, err := os.Open("report.pdf")
if err != nil {
	log.Fatal(err)
}
defer f.Close()
report, err := client.Files.Upload(ctx, "report.pdf", f) // attachments take what Upload returns
if err != nil {
	log.Fatal(err)
}
session, err := client.Sessions.Create(ctx, &sai.SessionOptions{Machine: "m_7f2a"})
if err != nil {
	log.Fatal(err)
}
turn, err := session.Send(ctx, "Open Notepad, type hello, save it to the desktop as hello.txt", &sai.SendOptions{
	Attachments: []*sai.Attachment{report},
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(turn.ID)
```

```java title="Give Sai a task"
import ai.simular.sai.Attachment;
import ai.simular.sai.Sai;
import ai.simular.sai.SendOptions;
import ai.simular.sai.Session;
import ai.simular.sai.Turn;
import java.nio.file.Path;
import java.util.List;

Sai sai = new Sai();
Attachment report = sai.files().upload(Path.of("report.pdf")); // attachments take what upload returns
Session session = sai.sessions().create("m_7f2a");
Turn turn = session.send("Open Notepad, type hello, save it to the desktop as hello.txt",
    new SendOptions().attachments(List.of(report)));
System.out.println(turn.id());
```

```csharp title="Give Sai a task"
using Simular.Sai;

var sai = new SaiClient();
var report = await sai.Files.UploadAsync("report.pdf"); // attachments take what UploadAsync returns
var session = await sai.Sessions.CreateAsync(machine: "m_7f2a");
var turn = await session.SendAsync(
    "Open Notepad, type hello, save it to the desktop as hello.txt",
    new SendOptions { Attachments = [report] });
Console.WriteLine(turn.Id);
```

```ruby title="Give Sai a task"
require "sai"

sai = Sai::Client.new
report = sai.files.upload("report.pdf") # attachments take what upload returns
session = sai.sessions.create(machine: "m_7f2a")
turn = session.send(
  "Open Notepad, type hello, save it to the desktop as hello.txt",
  attachments: [report]
)
puts turn.id
```

| Field         | Type    | Required | Notes                                                                                                                                                                                    |
| ------------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`     | string  | yes      | The task, in plain language.                                                                                                                                                             |
| `machineId`   | string  | no       | Omit with one computer, or on a free account. With several computers the API answers `400` and lists the candidates.                                                                     |
| `wait`        | boolean | no       | Default `true`: stream the turn over SSE. `false`: return JSON at once and poll [`/events`](/documentation/api-reference/events).                                                        |
| `model`       | string  | no       | An id from [`/models`](/documentation/api-reference/models) or `auto`. Written to the session before delivery and kept until you pass another. Omit to keep the session's current model. |
| `attachments` | array   | no       | Each entry is the response of a [`/upload`](/documentation/api-reference/upload) call. `width` and `height` are optional integers for images.                                            |
| `autonomous`  | boolean | no       | Default `false`. `true` runs the turn this message starts without approval cards. See [Unattended runs](#unattended-runs).                                                               |
| `sessionId`   | string  | no       | Continue this session. It has to be yours and on the same computer. Omit to continue your API conversation on that computer.                                                             |
| `options`     | object  | no       | Advanced. Typed output, checks, idempotency and step recording. See [below](#options-advanced).                                                                                          |

## Options (advanced)

A plain message needs none of these. Add `options` when your code has to use the result: the turn then also returns a typed `output`, checked against what you asked for. [Structured output](/documentation/concepts/structured-output) explains each one with examples.

The smallest useful one asks for JSON:

```bash title="Give Sai a task with typed output"
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

```python title="Give Sai a task with typed output"
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

```typescript title="Give Sai a task with typed output"
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

```go title="Give Sai a task with typed output"
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

```java title="Give Sai a task with typed output"
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

```csharp title="Give Sai a task with typed output"
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

```ruby title="Give Sai a task with typed output"
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

Then poll [`GET /v1/agents/turns/{turnId}`](/documentation/api-reference/turns) until `status` is `succeeded`, and read `output.title`.

| Option             | Type            | Notes                                                                                                                                               |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output_schema`    | object          | JSON Schema the turn's `output` has to match. At most 32 KB. `pattern` uses RE2 syntax.                                                             |
| `inputs`           | object          | Values for the `{{name}}` placeholders in `message`: strings, numbers or booleans. Every placeholder needs a value, and every value has to be used. |
| `success_criteria` | string or array | A string for a model to judge the result against (at most 4,000 characters), or up to 20 checks `{ id, check, returnEvidence? }`.                   |
| `idempotency_key`  | string          | At most 255 characters, unique per account. The same key again returns the earlier turn and sends nothing.                                          |
| `recordTrajectory` | boolean         | Default `false`. `true` records each step with a screenshot, for [`/trajectory`](/documentation/api-reference/turns#trajectory).                    |
| `thinkingLevel`    | string          | `off`, `low`, `medium`, `high` or `xhigh`: how long Sai reasons on this turn. Default: the account's Thinking strength setting.                     |

`output_schema`, `inputs` or `success_criteria` make the message structured. `idempotency_key`, `recordTrajectory` and `thinkingLevel` work on plain messages too. An unknown key in `options`, or an option sent next to `message` instead of inside `options`, is a `400`.

## Unattended runs

Sai asks before risky actions, and a turn waits on each approval until someone answers it with [`/approve`](/documentation/api-reference/approve). A script with nobody to answer can send `"autonomous": true` instead:

```bash title="Run a task without approvals"
curl -s "$SAI_API_URL/v1/agents/message" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Export last month'\''s invoices to CSV",
    "autonomous": true,
    "wait": false
  }'
```

```python title="Run a task without approvals"
from sai import Sai

sai = Sai()
session = sai.sessions.create()
turn = session.send("Export last month's invoices to CSV", autonomous=True)
print(turn.id)
```

```typescript title="Run a task without approvals"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = await sai.sessions.create()
const turn = await session.send("Export last month's invoices to CSV", { autonomous: true })
console.log(turn.id)
```

```go title="Run a task without approvals"
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
turn, err := session.Send(ctx, "Export last month's invoices to CSV", &sai.SendOptions{Autonomous: true})
if err != nil {
	log.Fatal(err)
}
fmt.Println(turn.ID)
```

```java title="Run a task without approvals"
import ai.simular.sai.Sai;
import ai.simular.sai.SendOptions;
import ai.simular.sai.Session;
import ai.simular.sai.Turn;

Sai sai = new Sai();
Session session = sai.sessions().create();
Turn turn = session.send("Export last month's invoices to CSV", new SendOptions().autonomous(true));
System.out.println(turn.id());
```

```csharp title="Run a task without approvals"
using Simular.Sai;

var sai = new SaiClient();
var session = await sai.Sessions.CreateAsync();
var turn = await session.SendAsync("Export last month's invoices to CSV", new SendOptions { Autonomous = true });
Console.WriteLine(turn.Id);
```

```ruby title="Run a task without approvals"
require "sai"

sai = Sai::Client.new
session = sai.sessions.create
turn = session.send("Export last month's invoices to CSV", autonomous: true)
puts turn.id
```

The turn this message starts runs as if "Trust for this task" had been answered up front, and the grant ends with the turn. A message that lands while a turn is running changes nothing for that turn. Approvals that only a person can complete in a browser (`isLinkOnly`, such as signing in to an account) still stop the turn. Only send it for work you would approve anyway: the agent acts without asking.

## Response with `wait: false`

```json title="202 Accepted · Message sent"
{
  "sessionId": "cs_01HZY",
  "machineId": "m_7f2a",
  "queued": false,
  "turnId": "turn_abPDn3htwBVxbWOhuLPL"
}
```

| Field       | Notes                                                                                                                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionId` | Pass to `GET /events`. The same id across messages: each one continues this API key's conversation on that computer, desktop included (every key has its own). [`/new-session`](/documentation/api-reference/new-session) starts a fresh one. |
| `machineId` | The computer the message landed on. Useful when you omitted it.                                                                                                                                                                               |
| `queued`    | `true` when Sai was busy and the message was parked as a steer for the running task.                                                                                                                                                          |
| `turnId`    | The turn the message started, or with `queued: true` the running turn it joined. Pass to [`GET /v1/agents/turns/{turnId}`](/documentation/api-reference/turns) for the result.                                                                |

A repeated `options.idempotency_key` returns `200` with the earlier turn, in the shape of [`GET /v1/agents/turns/{turnId}`](/documentation/api-reference/turns#get-a-turn), plus `"idempotent_replay": true`. Nothing is sent to Sai.

Refusals on this path are plain JSON, not stream events. A message the agent could not take (for example, the computer is unavailable) returns `409 { "error": "..." }`. A message that was handled without starting a task, such as a plain acknowledgement, returns `200 { "error": "..." }` with the reply text in `error` and no `sessionId`.

## Response with `wait: true`

`200` with `Content-Type: text/event-stream`. Each frame is `data: {...}` followed by a blank line; the stream ends with `data: [DONE]`.

```text title="200 OK · Event stream"
data: {"type":"start","messageId":"msg_1"}

data: {"type":"data-session","data":{"sessionId":"cs_01HZY"}}

data: {"type":"data-turn","data":{"turnId":"turn_abPDn3htwBVxbWOhuLPL"}}

data: {"type":"text-start","id":"t_1"}

data: {"type":"text-delta","id":"t_1","delta":"Opening Notepad."}

data: {"type":"data-approval-request","data":{"approvalId":"ap_7Qw","title":"Command Approval Required","description":"","approvalType":"exec","isLinkOnly":false,"command":"notepad.exe"}}

data: {"type":"text-end","id":"t_1"}

data: {"type":"data-turn-result","data":{"turnId":"turn_abPDn3htwBVxbWOhuLPL","status":"succeeded","output":"Saved hello.txt to the desktop.","reason_code":null,"usage":{"inputTokens":18450,"outputTokens":2210}}}

data: {"type":"finish","finishReason":"stop"}

data: [DONE]
```

`data-turn-result` carries the turn as [`GET /v1/agents/turns/{turnId}`](/documentation/api-reference/turns#get-a-turn) returns it (shortened above). It comes just before `finish`, so a client that stops reading at `finish` still gets it. The stream waits up to 4 minutes after the turn for the output and checks; if they are not ready by then, the frame has `status: "finalizing"` and you read the result with `GET /v1/agents/turns/{turnId}`.

The stream stays open while an approval is pending. Answer it with [`/approve`](/documentation/api-reference/approve) from another connection. The full frame list is on the [Events](/documentation/api-reference/events) page.

## Errors

| Status | Body                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Validation failed, or `machineId` was omitted and it cannot be resolved (below).                                                                                                                                        |
| `400`  | `{ "error": "unknown_model", "message": "Unknown model \"x\". See GET /v1/agents/models." }`                                                                                                                            |
| `400`  | `{ "error": "invalid_template", "message": "{{month}} has no value in inputs." }`. Also for an unused input.                                                                                                            |
| `400`  | `{ "error": "invalid_output_schema", "message": "output_schema is not valid JSON Schema: ..." }`                                                                                                                        |
| `400`  | `{ "error": "session_machine_mismatch", "message": "Session cs_01HZY is on machine m_9c1e." }`                                                                                                                          |
| `403`  | `{ "error": "Machine not found or does not belong to your account." }`                                                                                                                                                  |
| `403`  | `{ "error": "model_not_allowed_for_plan", "message": "...", "allowedModels": ["auto"] }` on the free plan. See [Models](/documentation/api-reference/models#free-plan).                                                 |
| `403`  | `{ "error": "spend_cap_reached", "message": "...", "resetsAt": "2026-11-01T00:00:00.000Z" }`: the API key reached its monthly spend limit. See [Spend limits](/documentation/concepts/billing-and-limits#spend-limits). |
| `404`  | `{ "error": "session_not_found", "message": "No open session with this id on your account." }`                                                                                                                          |
| `409`  | `{ "error": "..." }`: the message was refused (`wait: false` only).                                                                                                                                                     |
| `409`  | `{ "error": "session_busy", "message": "..." }`: a structured message, `recordTrajectory` on a turn that does not record, or `thinkingLevel`, sent while Sai is working. Retry when idle.                               |
| `429`  | `{ "error": "Message rate limit exceeded. Maximum 600 messages per hour." }` (60 on the free plan)                                                                                                                      |

When `machineId` is omitted and several computers qualify, the `400` lists them:

```json title="400 Bad Request · Several computers"
{
  "error": "Several computers are linked to this account. Pass machineId. See GET /v1/agents/machines.",
  "machines": [
    { "machineId": "m_7f2a", "name": "Work Desktop" },
    { "machineId": "m_9c1e", "name": "Sai cloud computer" }
  ]
}
```

`name` is absent for a computer without one. A paid account with no computer at all gets a `400` asking you to create one in the Sai app or the portal.

## Gotchas

- Attachments need a `fileId`. Upload first; do not build attachment objects by hand.
- The default is `wait: true`. A coding agent or a script should send `wait: false` explicitly.
- With or without `options`, a message without `sessionId` continues this API key's conversation on that computer. Call [`/new-session`](/documentation/api-reference/new-session) first when a result should not depend on earlier messages.
- Errors in `options` return before anything is sent.
- On a free account the first request of the day starts the computer. Expect about two minutes before the first event.

> **Note**
>
> `wait: false` and optional `machineId` are available from October 1. Today's staging streams every message and requires `machineId`.
