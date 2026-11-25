# Approvals

Two classes of approval, and how to answer each.

Sai stops and asks before some actions: running a command, choosing between options, connecting a Google account, typing a site password, verifying a phone. Each ask is an approval request. Your loop must answer it or the task waits.

An approval arrives as an event of type `data-approval-request`, and `GET /events` reports `status: "needs_approval"` while it is pending.

## The one field that matters

Look at `isLinkOnly` first. It splits approvals into two classes.

### `isLinkOnly: false`: answer over the API

Command approvals (`approvalType: "exec"`), action approvals and choice questions (`approvalType: "choice"`). Answer with `POST /approve`. These events carry no `approvalUrl`: the approval page completes only link-only approvals.

```json title="Command approval event"
{
  "type": "data-approval-request",
  "data": {
    "approvalId": "ap_7Qw",
    "title": "Command Approval Required",
    "description": "Sai wants to run a command.",
    "approvalType": "exec",
    "isLinkOnly": false,
    "command": "powershell -c Get-ChildItem C:\\Users\\sai\\Desktop",
    "cwd": "C:\\Users\\sai"
  }
}
```

```bash title="Answer a command approval"
curl -s "$SAI_API_URL/v1/agents/approve" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "approvalId": "ap_7Qw", "response": "yes" }'
```

```python title="Answer a command approval"
from sai import Sai

sai = Sai()
session = sai.sessions.resume("cs_01HZY")
session.respond("ap_7Qw", "yes")
```

```typescript title="Answer a command approval"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = sai.sessions.resume('cs_01HZY')
await session.respond('ap_7Qw', 'yes')
```

```go title="Answer a command approval"
import (
	"context"
	"log"

	sai "github.com/simular-ai/sai-sdk/go"
)

ctx := context.Background()
client, err := sai.New(sai.Options{})
if err != nil {
	log.Fatal(err)
}
session := client.Sessions.Resume("cs_01HZY", nil)
if _, err := session.Respond(ctx, &sai.Approval{ID: "ap_7Qw"}, "yes", nil); err != nil {
	log.Fatal(err)
}
```

```java title="Answer a command approval"
import ai.simular.sai.Sai;
import ai.simular.sai.Session;

Sai sai = new Sai();
Session session = sai.sessions().resume("cs_01HZY");
session.respond("ap_7Qw", "yes");
```

```csharp title="Answer a command approval"
using Simular.Sai;

var sai = new SaiClient();
var session = sai.Sessions.Resume("cs_01HZY");
await session.RespondAsync("ap_7Qw", "yes");
```

```ruby title="Answer a command approval"
require "sai"

sai = Sai::Client.new
session = sai.sessions.resume("cs_01HZY")
session.respond("ap_7Qw", "yes")
```

`response` is one of:

| Value  | Effect                                                       |
| ------ | ------------------------------------------------------------ |
| `yes`  | Allow this one request.                                      |
| `task` | Allow this and stop asking for the rest of the current task. |
| `no`   | Refuse. Sai continues without it.                            |

A choice question carries `questions`. Answer it with `selections`, one inner array per question:

```json title="Choice question event"
{
  "type": "data-approval-request",
  "data": {
    "approvalId": "ap_9Lm",
    "title": "Which folder?",
    "description": "",
    "approvalType": "choice",
    "isLinkOnly": false,
    "questions": [
      {
        "message": "Which folder should I save the report to?",
        "options": [
          { "value": "desktop", "label": "Desktop" },
          { "value": "documents", "label": "Documents" }
        ],
        "multiple": false,
        "allowOther": false
      }
    ]
  }
}
```

```bash title="Answer a choice question"
curl -s "$SAI_API_URL/v1/agents/approve" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "approvalId": "ap_9Lm", "response": "yes", "selections": [["desktop"]] }'
```

```python title="Answer a choice question"
from sai import Sai

sai = Sai()
session = sai.sessions.resume("cs_01HZY")
session.respond("ap_9Lm", "yes", selections=[["desktop"]])
```

```typescript title="Answer a choice question"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = sai.sessions.resume('cs_01HZY')
await session.respond('ap_9Lm', 'yes', { selections: [['desktop']] })
```

```go title="Answer a choice question"
import (
	"context"
	"log"

	sai "github.com/simular-ai/sai-sdk/go"
)

ctx := context.Background()
client, err := sai.New(sai.Options{})
if err != nil {
	log.Fatal(err)
}
session := client.Sessions.Resume("cs_01HZY", nil)
if _, err := session.Respond(ctx, &sai.Approval{ID: "ap_9Lm"}, "yes", &sai.RespondOptions{Selections: [][]string{{"desktop"}}}); err != nil {
	log.Fatal(err)
}
```

```java title="Answer a choice question"
import ai.simular.sai.Sai;
import ai.simular.sai.Session;
import java.util.List;

Sai sai = new Sai();
Session session = sai.sessions().resume("cs_01HZY");
session.respond("ap_9Lm", "yes", List.of(List.of("desktop")));
```

```csharp title="Answer a choice question"
using Simular.Sai;

var sai = new SaiClient();
var session = sai.Sessions.Resume("cs_01HZY");
await session.RespondAsync("ap_9Lm", "yes", selections: [["desktop"]]);
```

```ruby title="Answer a choice question"
require "sai"

sai = Sai::Client.new
session = sai.sessions.resume("cs_01HZY")
session.respond("ap_9Lm", "yes", selections: [["desktop"]])
```

A value that was not offered is rejected with `422`, unless the question has `allowOther: true` or no options, in which case free text is accepted.

### `isLinkOnly: true`: open `approvalUrl` in a browser

Google connect (`service_connect`), a site password or other typed input (`user_input`) and phone verification (`phone_verification`). These need a human in a browser. The API cannot answer them.

```json title="Link-only approval event"
{
  "type": "data-approval-request",
  "data": {
    "approvalId": "ap_2Vd",
    "title": "Connect your Google account",
    "description": "Sai needs access to Gmail to read your inbox.",
    "approvalType": "service_connect",
    "isLinkOnly": true,
    "approvalUrl": "https://sai.simular.ai/approval/3fA9kQ2xYz/ap_2Vd?from=api"
  }
}
```

Hand `approvalUrl` to the person who owns the account. Keep polling `GET /events`. When they finish, `status` returns to `running`.

Calling `POST /approve` on a link-only approval returns `409`:

```json title="409 Conflict · link_only"
{
  "error": "link_only",
  "message": "This approval must be completed in a browser. Open approvalUrl.",
  "approvalUrl": "https://sai.simular.ai/approval/3fA9kQ2xYz/ap_2Vd?from=api"
}
```

## Finding the pending approval

`GET /events` repeats the blocking approval in a top-level `approval` field whenever `status` is `needs_approval`, with the same shape as the event's `data`. Read that instead of scanning `events`; the event itself is delivered once, on the poll where it first appeared.

## Expiry

Some approvals carry `expiresAt`, a Unix time in milliseconds. After it passes, `POST /approve` returns `409` because the request is no longer pending.

## Timing

A free account's first request of the day can take about two minutes while its computer starts. Nothing is wrong. Keep polling with `wait=30` and act on the first approval when it arrives.

> **Note**
>
> `approvalUrl`, `expiresAt` and the `409 link_only` answer are available from October 1. The URL is `https://sai.simular.ai/approval/{uid}/{approvalId}?from=api`, where `uid` is the `userId` from `GET /auth`; on staging the host is the staging web app.

## When Sai needs a person

Some steps need a person at the screen rather than an answer: a sign-in Sai has no password for, a captcha, a code sent to someone's phone. When Sai's turn ends on one of those, hand the computer's screen to that person with a live link:

1. Call [`POST /v1/agents/machines/{machineId}/live`](/documentation/api-reference/machines#live-screen) and take `liveUrl` from the response.
2. Send `liveUrl` to the person. They open it in a browser; no Simular account or sign-in is needed. The link works for 30 minutes.
3. They do the step with the mouse and keyboard. While a turn runs, the page pauses its own input and shows **Sai is working**. The pause is only on the page, not enforced by the server.
4. When they are done, send a message to the same session, such as "I've signed in, carry on." Sai picks up from the screen as the person left it.
5. Revoke the link with [`DELETE /v1/agents/machines/{machineId}/live`](/documentation/api-reference/machines#revoke-live-links), or let it expire.

```bash title="Get a link for a person"
curl -s -X POST "$SAI_API_URL/v1/agents/machines/$MACHINE_ID/live" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```bash title="Carry on once they are done"
curl -s "$SAI_API_URL/v1/agents/message" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "message": "I have signed in. Carry on with the task.", "machineId": "m_7f2a", "sessionId": "cs_01HZY", "wait": false }'
```

There is no separate call to take over the computer or hand it back. Sai's turn ending is what frees the screen, and your next message is what gives it back to Sai. Ask the person to finish before you send it: once a new turn starts, the page pauses their input.

Anyone with `liveUrl` can use the computer, even while Sai is working, so send it only to the person who should act, and revoke it when they are done. Link-only approvals are different: they come with their own `approvalUrl` (above), and the person completes them there, not on the screen.

With an [Organisation](/documentation/organisations), your backend can do the same with a [Tenant token](/documentation/organisations/tenant-tokens) and give the link to your customer, the Tenant's own user, so they sign in to their own accounts on their machine without a Simular account.
