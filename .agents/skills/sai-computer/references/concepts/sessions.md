# Sessions

One conversation per computer on the API channel.

A session is a conversation with Sai on one computer. (Not to be confused with direct control, where your own code drives the computer: see [Direct control](/documentation/concepts/direct-control).) Every message you send with the same API key lands in the same session for that computer, so a follow-up message continues the last task's context.

## The API channel

Sai has several channels: the desktop app, the `sai` CLI, messaging integrations and this API. Each channel keeps its own session per computer. A message sent over the API never appears in the desktop app's conversation, and the other way round.

The API's channel is named `api`. Endpoints that read or rotate a session take `channel: "api"`.

## One conversation per API key

Each API key has its own conversation on each computer, so messages sent with one key don't land in another key's conversation. `/context`, `/session`, `/new-session` and `/abort` (by `machineId`) act on the calling key's conversation, and `/sessions` marks it as active. This separates conversations; it is not access control between keys, since every key on the account can still list and read the account's sessions by id. The portal Playground, which calls the API with your signed-in session rather than a key, has its own conversation too.

The same holds for the `sai` CLI channel when it is called with an API key. Every session started by a key is bound to that key on our side, so its usage can be attributed to that key.

> **Note**
>
> Before per-key conversations, every key on a computer and the Playground shared one conversation. After the change, each key and the Playground start a fresh conversation on their first call. The old shared conversation is not deleted.

## Session ids

`POST /message` returns the `sessionId` its message landed in. You use it to poll `GET /events`. The id stays the same across messages until you start a new session.

## The session's model

Each session runs on one model, `auto` unless you set one. Pass `model` on `POST /message` to change it; the choice is written to the session before the message lands and stays until you pass another. See [Models](/documentation/api-reference/models).

## Starting fresh

`POST /new-session` with `channel: "api"` rotates the conversation on a computer. The next message starts with no context. See [New session](/documentation/api-reference/new-session).

## Token usage

`GET /events` reports `usage` for the current task and `sessionUsage` for the whole session (see [Token usage](/documentation/api-reference/events#token-usage)). Each task is counted on its own, so tasks in the same session compare fine. But a long session carries its earlier tasks in Sai's context, and that context is re-read on every step: start a new session when you want each run's input to stand alone.

Their `costUsd` is a live count of the model calls Sai makes to do the task, not the billing figure: it leaves out choosing a model, locating elements on the screen and the calls Sai makes after a task finishes, to fill in `output_schema` and check `success_criteria`. For what a Tenant's session cost, use [Session spend](/documentation/organisations/session-spend).

## One task at a time

A computer runs one task at a time. If you send a message while Sai is busy, the API accepts it and parks it as a steer for the running task:

```json title="202 Accepted · Message queued as a steer"
{ "sessionId": "cs_01HZY", "machineId": "m_7f2a", "queued": true }
```

`queued: true` means the message was folded into the running turn, not started as a new one. Poll the same `sessionId`. The `turnId` in the response is the running turn's. A message with [structured output options](/documentation/concepts/structured-output) is never folded in: it gets `409 session_busy`.

## Status

`GET /events` reports one of four states for the session:

| `status`         | Meaning                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| `running`        | Sai is working. Keep polling.                                               |
| `needs_approval` | An approval is pending. See [Approvals](/documentation/concepts/approvals). |
| `idle`           | The turn is finished. `text` holds the answer.                              |
| `error`          | The turn failed. The `error` event holds `errorText`.                       |

## What a caller can see

By default no screenshots travel over this API. What you get for a task is one progress line per step (the agent's own one-line title for it), the first line of each console message a step printed, and the final `text`. That is the whole record. Sai puts what it sees on the screen into those lines. To watch the computer itself, open the session in the Sai app.

To keep a fuller record, send the message with [`options.recordTrajectory: true`](/documentation/api-reference/message#options-advanced). Sai then keeps every step of that turn: the screen before it, its title, the code it ran and the agent's reasoning. Read them later with [`GET /v1/agents/turns/{turnId}/trajectory`](/documentation/api-reference/turns#trajectory), for example to debug a run, or to [turn it into code](/documentation/concepts/learned-code).

## Reading history

`GET /context?machineId=...&channel=api` returns recent messages from the API session. `GET /sessions?machineId=...&channel=api` lists sessions on a computer. Both default to the CLI's channel when `channel` is omitted, so always pass it.

The SDKs list your sessions on a computer (desktop, CLI and API), most recent first, with `active` on the API channel's current one, which the next message goes to:

```python title="List sessions"
from sai import Sai

sai = Sai()
for s in sai.sessions.list(machine=sai.machines.list()[0]):
    print(s.id, s.title, s.active)
```

```typescript title="List sessions"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const [pc] = await sai.machines.list()
for (const s of await sai.sessions.list({ machine: pc })) console.log(s.id, s.title, s.active)
```

```go title="List sessions"
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
machines, err := client.Machines.List(ctx)
if err != nil {
	log.Fatal(err)
}
sessions, err := client.Sessions.List(ctx, &sai.SessionOptions{Machine: machines[0].ID})
if err != nil {
	log.Fatal(err)
}
for _, s := range sessions {
	fmt.Println(s.ID, s.Title, s.Active)
}
```

```java title="List sessions"
import ai.simular.sai.Machine;
import ai.simular.sai.Sai;
import ai.simular.sai.SessionSummary;

Sai sai = new Sai();
Machine pc = sai.machines().list().get(0);
for (SessionSummary s : sai.sessions().list(pc)) System.out.println(s.id() + " " + s.title() + " " + s.active());
```

```csharp title="List sessions"
using Simular.Sai;

var sai = new SaiClient();
var pc = (await sai.Machines.ListAsync())[0];
foreach (var s in await sai.Sessions.ListAsync(machine: pc)) Console.WriteLine($"{s.Id} {s.Title} {s.Active}");
```

```ruby title="List sessions"
require "sai"

sai = Sai::Client.new
sai.sessions.list(machine: sai.machines.list.first).each do |s|
  puts "#{s.id} #{s.title} #{s.active}"
end
```

> **Note**
>
> The `channel` parameter on `/context`, `/sessions` and `/session` is available from October 1.
