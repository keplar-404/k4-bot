# Events

GET /v1/agents/events, and the event vocabulary shared with the stream.

Returns what happened in a session since a cursor. Long-polls when nothing is new.

## Request

```bash title="Poll for events"
curl -s "$SAI_API_URL/v1/agents/events?sessionId=cs_01HZY&since=eyJ0dXJuIjoxNzkwMDAwMDEyMzQ1fQ&wait=30" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Poll for events"
from sai import Sai

sai = Sai()
session = sai.sessions.resume("cs_01HZY")
turn = session.send("Open Notepad and type hello")
for ev in turn.events():
    print(ev.kind, ev.text)
```

```typescript title="Poll for events"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = sai.sessions.resume('cs_01HZY')
const turn = await session.send('Open Notepad and type hello')
for await (const ev of turn.events()) {
  console.log(ev.kind, ev.text)
}
```

```go title="Poll for events"
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
session := client.Sessions.Resume("cs_01HZY", nil)
turn, err := session.Send(ctx, "Open Notepad and type hello", nil)
if err != nil {
	log.Fatal(err)
}
for ev, err := range turn.Events(ctx, nil) {
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(ev.Kind, ev.Text)
}
```

```java title="Poll for events"
import ai.simular.sai.Event;
import ai.simular.sai.Sai;
import ai.simular.sai.Session;
import ai.simular.sai.Turn;

Sai sai = new Sai();
Session session = sai.sessions().resume("cs_01HZY");
Turn turn = session.send("Open Notepad and type hello");
for (Event ev : turn.events()) {
  System.out.println(ev.kind() + " " + ev.text());
}
```

```csharp title="Poll for events"
using Simular.Sai;

var sai = new SaiClient();
var session = sai.Sessions.Resume("cs_01HZY");
var turn = await session.SendAsync("Open Notepad and type hello");
await foreach (var ev in turn.EventsAsync())
{
    Console.WriteLine($"{ev.Kind} {ev.Text}");
}
```

```ruby title="Poll for events"
require "sai"

sai = Sai::Client.new
session = sai.sessions.resume("cs_01HZY")
turn = session.send("Open Notepad and type hello")
turn.events do |ev|
  puts "#{ev.kind} #{ev.text}"
end
```

| Query       | Required | Notes                                                                            |
| ----------- | -------- | -------------------------------------------------------------------------------- |
| `sessionId` | yes      | From `POST /message`. Must belong to the caller, else `403`.                     |
| `since`     | no       | The `cursor` from the previous response. Opaque. Omit on the first call.         |
| `wait`      | no       | Seconds to hold the request open when nothing is new. Default `0`, maximum `60`. |

## Response

```json title="200 OK · Events"
{
  "sessionId": "cs_01HZY",
  "status": "running",
  "events": [
    { "type": "reasoning-start", "id": "r_1" },
    { "type": "reasoning-delta", "id": "r_1", "delta": "I will open Notepad first." },
    { "type": "reasoning-end", "id": "r_1" },
    { "type": "tool-input-start", "toolCallId": "tc_4", "toolName": "execute" },
    {
      "type": "tool-input-available",
      "toolCallId": "tc_4",
      "toolName": "execute",
      "input": {
        "title": "Opening Notepad and typing the line",
        "code": "open('notepad')\ntype('hello')"
      }
    },
    {
      "type": "data-progress",
      "data": { "text": "Opening Notepad and typing the line", "tool": "execute" }
    },
    { "type": "data-progress", "data": { "text": "Notepad window is focused", "tool": "execute" } }
  ],
  "text": "",
  "cursor": "eyJ0dXJuIjoxNzkwMDAwMDEyMzQ1LCJzZWVuIjpbInJfMSIsInRjXzQiXX0"
}
```

| Field          | Notes                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `sessionId`    | Echoed back.                                                                                                                    |
| `status`       | `running`, `needs_approval`, `idle` or `error`.                                                                                 |
| `events`       | New events since `since`, in order. Same shapes as the SSE frames, without `start`, `data-session`, `data-status` and `[DONE]`. |
| `text`         | Sai's final assistant text for the current turn so far. On `idle`, this is the answer.                                          |
| `cursor`       | Opaque base64url string. Pass as `since` next time. Examples on this site are illustrative.                                     |
| `approval`     | Present when `status` is `needs_approval`: the first pending approval, same shape as `data-approval-request.data`.              |
| `usage`        | This task's model usage so far. See [Token usage](#token-usage). Absent until Sai's first model call in the task.               |
| `sessionUsage` | The same numbers for the whole session so far, across its tasks. Absent alongside `usage`.                                      |

With `approval` you do not have to scan `events` to find what is blocking the task:

```json title="200 OK · Events, waiting on an approval"
{
  "sessionId": "cs_01HZY",
  "status": "needs_approval",
  "events": [
    {
      "type": "data-approval-request",
      "data": {
        "approvalId": "ap_7Qw",
        "title": "Command Approval Required",
        "description": "Sai wants to run a command.",
        "approvalType": "exec",
        "isLinkOnly": false,
        "command": "notepad.exe"
      }
    }
  ],
  "text": "",
  "cursor": "eyJ0dXJuIjoxNzkwMDAwMDEyMzQ1LCJzZWVuIjpbImFwOmFwXzdRdyJdfQ",
  "approval": {
    "approvalId": "ap_7Qw",
    "title": "Command Approval Required",
    "description": "Sai wants to run a command.",
    "approvalType": "exec",
    "isLinkOnly": false,
    "command": "notepad.exe"
  }
}
```

Each assistant message arrives once, as a `start`, one `delta` with the whole message, and an `end`. A slow poller still sees every message exactly once. A new message from you starts a new turn and resets the cursor; the response then reports the new turn only.

## The loop

1. `POST /message` with `wait: false`.
2. `GET /events?sessionId=...&wait=30`.
3. Act on `status`: `running`, poll again with `since=cursor`; `needs_approval`, see [Approvals](/documentation/concepts/approvals); `idle`, read `text`; `error`, read the `error` event.

Keep `wait` at 30 to 60 seconds. It is capped at 60 so a single call never approaches the two-minute timeout most tool runners apply.

The request is held while `status` is `running` or `needs_approval`, so a caller that handed a link-only approval to a human can keep long-polling and is woken when the agent resumes. On `idle` and `error` it returns at once.

## What a caller can see

There are no screenshots on this API. The record of a task is:

- one `data-progress` line per step, written by the agent for a human (the tool call's `title`),
- the first line of each console message the step printed,
- the final assistant `text`.

Sai describes what is on the screen in those lines and in `text`. If you need to see the computer, open the session in the Sai app.

## Errors

| Status | Body                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `{ "error": "sessionId is required." }`                                                                                               |
| `403`  | `{ "error": "Session not found or does not belong to your account." }` for a missing session and for another account's session alike. |
| `429`  | `{ "error": "Event poll rate limit exceeded. Use wait= to long-poll." }` after 1200 calls in an hour.                                 |

> **Note**
>
> `GET /events` is available from October 1. Today's staging has only the SSE path.

## Event vocabulary

Both the poll and the stream use these types.

### `text-delta`

Final assistant text. In the poll, one delta carries a whole message; in the stream, concatenate deltas with the same `id`.

```json title="text-delta event"
{ "type": "text-delta", "id": "t_1", "delta": "The file is saved." }
```

### `reasoning-delta`

Mid-turn narration: what Sai is about to do. Show it as progress, not as the answer.

```json title="reasoning-delta event"
{ "type": "reasoning-delta", "id": "r_1", "delta": "I will open Notepad first." }
```

### `data-progress`

A progress line from a running tool. `text` comes from one of three places:

- the tool call's `title`: one line the agent wrote for a human, emitted when the call starts;
- the first line of each console message in the tool's result, with accessibility-tree dumps and element-reference listings filtered out, each line capped at 300 characters;
- `progressLines` on a result from the desktop agent (your own computer), passed through as written.

```json title="data-progress event"
{
  "type": "data-progress",
  "data": { "text": "Opening Notepad and typing the line", "tool": "execute" }
}
```

### `tool-input-start`

A tool call began. The stream adds `toolMetadata`; the poll does not.

```json title="tool-input-start event"
{ "type": "tool-input-start", "toolCallId": "tc_4", "toolName": "execute" }
```

### `tool-input-available`

Follows `tool-input-start` with the call's `input`. For the cloud agent's `execute` tool it is `{ title, code }`; `code` is cut at 4000 characters with a note of how much was dropped. On the stream, `input` is `null`.

```json title="tool-input-available event"
{
  "type": "tool-input-available",
  "toolCallId": "tc_4",
  "toolName": "execute",
  "input": {
    "title": "Opening Notepad and typing the line",
    "code": "open('notepad')\ntype('hello')"
  }
}
```

### `tool-output-error`

A tool call failed. Sai usually recovers; the task is not over. `errorText` is the result's `error` string, capped at 500 characters, or the last error-level console line when there is none.

```json title="tool-output-error event"
{ "type": "tool-output-error", "toolCallId": "tc_4", "errorText": "Window not found" }
```

When the failure is one of the two exhaustion cases below, the event also carries `code` (and `resetsAt` for credits on the free plan):

```json title="tool-output-error event with code"
{
  "type": "tool-output-error",
  "toolCallId": "tc_9",
  "errorText": "Your free cloud computer time is used up for today.",
  "code": "free_computer_time_exhausted"
}
```

### `data-approval-request`

Sai is waiting for permission. Check `isLinkOnly`. Full field list on [Approvals](/documentation/concepts/approvals).

```json title="data-approval-request event"
{
  "type": "data-approval-request",
  "data": {
    "approvalId": "ap_7Qw",
    "title": "Command Approval Required",
    "description": "Sai wants to run a command.",
    "approvalType": "exec",
    "isLinkOnly": false,
    "command": "notepad.exe",
    "cwd": "C:\\Users\\sai",
    "expiresAt": 1790000600000
  }
}
```

### `finish`

The turn is complete.

```json title="finish event"
{ "type": "finish", "finishReason": "stop" }
```

### `error`

The turn failed.

```json title="error event"
{ "type": "error", "errorText": "The agent encountered an error. Check the Sai app for details." }
```

When the account ran out of credits, the event carries `code`. On the free plan it also carries `resetsAt`:

```json title="error event with code"
{
  "type": "error",
  "errorText": "insufficient_credits: your free credits for today are used up.",
  "code": "insufficient_credits",
  "resetsAt": "2026-09-30T00:00:00.000Z"
}
```

### Error codes

`code` appears on `error` and `tool-output-error` only for these two cases. Everything else has `errorText` alone. On either code, stop retrying: the same request will fail again today.

| `code`                         | Meaning                                                                                                                                | `resetsAt`                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `insufficient_credits`         | No credit left to spend. A free account's daily credits refresh at UTC midnight; a paid account tops up in the portal.                 | Free plan: the next UTC midnight, ISO 8601. Absent for a paid account or a Tenant. |
| `free_computer_time_exhausted` | The free plan's daily computer time is spent. The workspace was shut down. Resets daily; the exact local time is shown in the Sai app. | Absent.                                                                            |

`GET /account` shows the balance and plan behind either error. See [Billing and limits](/documentation/concepts/billing-and-limits#when-you-run-out).

### Framing

Text and reasoning are bracketed by start and end markers on both paths.

```json title="text-start event"
{ "type": "text-start", "id": "t_1" }
```

```json title="text-end event"
{ "type": "text-end", "id": "t_1" }
```

```json title="reasoning-start event"
{ "type": "reasoning-start", "id": "r_1" }
```

```json title="reasoning-end event"
{ "type": "reasoning-end", "id": "r_1" }
```

## Stream-only frames

The SSE path also emits these. They carry nothing the poll lacks.

```json title="start frame"
{ "type": "start", "messageId": "msg_1" }
```

```json title="data-session frame"
{ "type": "data-session", "data": { "sessionId": "cs_01HZY" } }
```

```json title="data-status frame"
{ "type": "data-status", "data": { "text": "Waking the computer" } }
```

```json title="data-turn frame"
{ "type": "data-turn", "data": { "turnId": "turn_abPDn3htwBVxbWOhuLPL" } }
```

`data-turn-result` comes just before `finish`, with the turn's result. It is the one stream frame the poll lacks: read the same result with [`GET /v1/agents/turns/{turnId}`](/documentation/api-reference/turns).

The stream ends with the literal line `data: [DONE]`.

## Token usage

`usage` counts the model calls Sai made for the current task, the one your last `POST /message` started, so you can compare runs. `sessionUsage` has the same shape and counts every task in the session:

```json title="usage"
{
  "usage": {
    "inputTokens": 18450,
    "outputTokens": 2210,
    "cacheReadTokens": 96300,
    "cacheWriteTokens": 0,
    "costUsd": 0.31,
    "modelCalls": 14,
    "byModel": {
      "claude-opus-5-5": {
        "inputTokens": 18450,
        "outputTokens": 2210,
        "cacheReadTokens": 96300,
        "cacheWriteTokens": 0,
        "costUsd": 0.31,
        "modelCalls": 14
      }
    }
  }
}
```

| Field                                 | Notes                                                        |
| ------------------------------------- | ------------------------------------------------------------ |
| `inputTokens`                         | Uncached input tokens.                                       |
| `outputTokens`                        | Output tokens, reasoning included.                           |
| `cacheReadTokens`, `cacheWriteTokens` | Prompt-cache reads and writes, where the model reports them. |
| `costUsd`                             | What these calls cost your credits, counted live. Not the billing figure: see below. |
| `modelCalls`                          | Model calls made in the task.                                |
| `byModel`                             | The same numbers per model id.                               |

- A message sent while a task is running steers it and keeps counting into the same task. The next task starts from zero.
- Only the model calls Sai makes to do the task are counted. Computer time is not, and neither are choosing a model for `auto`, locating elements on the screen, or the calls Sai makes after a task finishes, to fill in `output_schema` and check `success_criteria`. So `costUsd` is a live guide while you watch a task, not what the session is billed. For what a Tenant's session cost, use [Session spend](/documentation/organisations/session-spend).
- Tasks started before usage reporting shipped (October 1) have no `usage`.
- Each task is counted on its own, so runs in the same session compare fine. A [new session](/documentation/api-reference/new-session) also keeps earlier tasks out of Sai's context, which keeps their cost out of the next run's input tokens.
