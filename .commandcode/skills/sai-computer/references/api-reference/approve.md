# Approve

POST /v1/agents/approve

Answers a pending approval that has `isLinkOnly: false`. The task continues as soon as the answer lands.

## Request

```bash title="Answer an approval"
curl -s "$SAI_API_URL/v1/agents/approve" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "approvalId": "ap_7Qw", "response": "yes" }'
```

```python title="Answer an approval"
from sai import Sai

sai = Sai()
session = sai.sessions.resume("cs_01HZY")
status = session.respond("ap_7Qw", "yes")
print(status)
```

```typescript title="Answer an approval"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = sai.sessions.resume('cs_01HZY')
const status = await session.respond('ap_7Qw', 'yes')
console.log(status)
```

```go title="Answer an approval"
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
status, err := session.Respond(ctx, &sai.Approval{ID: "ap_7Qw"}, "yes", nil)
if err != nil {
	log.Fatal(err)
}
fmt.Println(status)
```

```java title="Answer an approval"
import ai.simular.sai.Sai;
import ai.simular.sai.Session;

Sai sai = new Sai();
Session session = sai.sessions().resume("cs_01HZY");
String status = session.respond("ap_7Qw", "yes");
System.out.println(status);
```

```csharp title="Answer an approval"
using Simular.Sai;

var sai = new SaiClient();
var session = sai.Sessions.Resume("cs_01HZY");
var status = await session.RespondAsync("ap_7Qw", "yes");
Console.WriteLine(status);
```

```ruby title="Answer an approval"
require "sai"

sai = Sai::Client.new
session = sai.sessions.resume("cs_01HZY")
status = session.respond("ap_7Qw", "yes")
puts status
```

For a choice question:

```bash title="Answer a choice question"
curl -s "$SAI_API_URL/v1/agents/approve" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "approvalId": "ap_9Lm",
    "response": "yes",
    "selections": [["desktop"]]
  }'
```

```python title="Answer a choice question"
from sai import Sai

sai = Sai()
session = sai.sessions.resume("cs_01HZY")
status = session.respond("ap_9Lm", "yes", selections=[["desktop"]])
print(status)
```

```typescript title="Answer a choice question"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = sai.sessions.resume('cs_01HZY')
const status = await session.respond('ap_9Lm', 'yes', { selections: [['desktop']] })
console.log(status)
```

```go title="Answer a choice question"
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
status, err := session.Respond(ctx, &sai.Approval{ID: "ap_9Lm"}, "yes", &sai.RespondOptions{Selections: [][]string{{"desktop"}}})
if err != nil {
	log.Fatal(err)
}
fmt.Println(status)
```

```java title="Answer a choice question"
import ai.simular.sai.Sai;
import ai.simular.sai.Session;
import java.util.List;

Sai sai = new Sai();
Session session = sai.sessions().resume("cs_01HZY");
String status = session.respond("ap_9Lm", "yes", List.of(List.of("desktop")));
System.out.println(status);
```

```csharp title="Answer a choice question"
using Simular.Sai;

var sai = new SaiClient();
var session = sai.Sessions.Resume("cs_01HZY");
var status = await session.RespondAsync("ap_9Lm", "yes", selections: [["desktop"]]);
Console.WriteLine(status);
```

```ruby title="Answer a choice question"
require "sai"

sai = Sai::Client.new
session = sai.sessions.resume("cs_01HZY")
status = session.respond("ap_9Lm", "yes", selections: [["desktop"]])
puts status
```

| Field        | Type       | Required    | Notes                                                                               |
| ------------ | ---------- | ----------- | ----------------------------------------------------------------------------------- |
| `approvalId` | string     | yes         | From the `data-approval-request` event.                                             |
| `response`   | string     | yes         | `yes`, `no` or `task`. `task` allows this and the rest of the current task.         |
| `selections` | string[][] | for choices | One inner array per question, in order. Values from `questions[i].options[].value`. |

## Response

```json title="200 OK · Approval answered"
{ "ok": true, "status": "approved" }
```

`status` is `approved`, `approved_task` or `denied`.

## Errors

| Status | Body                                                                                                                                                                                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404`  | `{ "error": "Approval request not found." }`                                                                                                                                                                                                                                            |
| `409`  | `{ "error": "link_only", "message": "This approval must be completed in a browser. Open approvalUrl.", "approvalUrl": "https://sai.simular.ai/approval/3fA9kQ2xYz/ap_2Vd?from=api" }` when `isLinkOnly` is `true` and the approval is still pending. Open the URL in a browser instead. |
| `409`  | `{ "error": "Approval request is no longer pending." }` when it was already answered or expired.                                                                                                                                                                                        |
| `422`  | A selection problem: a missing group, more than one pick on a single-select question, or a value that was not offered.                                                                                                                                                                  |
| `429`  | More than 20 calls in a minute.                                                                                                                                                                                                                                                         |

## Gotchas

- A choice approval with `response: "yes"` and no `selections` is recorded as a deny. Always send `selections` for `approvalType: "choice"`.
- `selections` on a non-choice approval returns `422`.
- Read `isLinkOnly` before calling. Link-only approvals cannot be answered here.

> **Note**
>
> The `409 link_only` body with `approvalUrl` is available from October 1. Today's staging returns a bare `400`.
