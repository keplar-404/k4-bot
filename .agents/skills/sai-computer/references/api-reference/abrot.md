# Abort

POST /v1/agents/abort

Stops a running task. Safe to call when nothing is running. A turn stopped before it answered ends `failed` with `reason_code: aborted`.

## Request

Recommended for API callers: name the session you started.

```bash title="Stop a session's task"
curl -s "$SAI_API_URL/v1/agents/abort" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "cs_01HZY" }'
```

```python title="Stop a session's task"
from sai import Sai

sai = Sai()
session = sai.sessions.resume("cs_01HZY")
print(session.abort())
```

```typescript title="Stop a session's task"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = sai.sessions.resume('cs_01HZY')
console.log(await session.abort())
```

```go title="Stop a session's task"
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
aborted, err := session.Abort(ctx)
if err != nil {
	log.Fatal(err)
}
fmt.Println(aborted)
```

```java title="Stop a session's task"
import ai.simular.sai.Sai;
import ai.simular.sai.Session;

Sai sai = new Sai();
Session session = sai.sessions().resume("cs_01HZY");
System.out.println(session.abort());
```

```csharp title="Stop a session's task"
using Simular.Sai;

var sai = new SaiClient();
var session = sai.Sessions.Resume("cs_01HZY");
Console.WriteLine(await session.AbortAsync());
```

```ruby title="Stop a session's task"
require "sai"

sai = Sai::Client.new
session = sai.sessions.resume("cs_01HZY")
p session.abort
```

Or name the computer and the channel:

```bash title="Stop the running task on a computer"
curl -s "$SAI_API_URL/v1/agents/abort" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "machineId": "m_7f2a",
    "channel": "api"
  }'
```

| Field       | Type   | Required         | Notes                                                                                                 |
| ----------- | ------ | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `sessionId` | string | one of the two   | The `sessionId` from `POST /message` or `GET /events`. Must belong to the caller.                     |
| `machineId` | string | one of the two   | Stops this API key's conversation on this computer for the given `channel`.                           |
| `channel`   | string | with `machineId` | `api` or `cli`. Omitted, it is `api` for an API key or a Tenant token, `cli` for a signed-in session. |

## Response

A task was stopped:

```json title="200 OK · Task stopped"
{ "ok": true, "aborted": true }
```

Nothing to stop:

```json title="200 OK · Nothing to stop"
{ "ok": true, "aborted": false, "reason": "session already idle or aborting" }
```

`reason` is `no active session` or `session already idle or aborting`.

## Errors

| Status | Body                                                                   |
| ------ | ---------------------------------------------------------------------- |
| `400`  | Neither `sessionId` nor `machineId` was sent.                          |
| `403`  | `{ "error": "Session not found or does not belong to your account." }` |
| `404`  | `{ "error": "Machine not found or does not belong to your account." }` |
| `429`  | More than 20 aborts in an hour.                                        |

## Gotchas

- Use `sessionId`. It needs no machine lookup, so it also works on a free account's computer between claims.
- With `machineId` and no `channel`, an API key or a Tenant token stops its own `api` conversation. The `sai` CLI sends `channel: "cli"`.
- Pending approvals on the aborted task are resolved as denied, so nothing is left waiting.
