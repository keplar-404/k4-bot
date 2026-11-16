# New session

POST /v1/agents/new-session

Starts a fresh conversation on a computer. The next message has no memory of earlier ones.

## Request

```bash title="Start a new session"
curl -s "$SAI_API_URL/v1/agents/new-session" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "machineId": "m_7f2a",
    "channel": "api"
  }'
```

```python title="Start a new session"
from sai import Sai

sai = Sai()
session = sai.sessions.create(machine="m_7f2a")
```

```typescript title="Start a new session"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = await sai.sessions.create({ machine: 'm_7f2a' })
```

```go title="Start a new session"
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
session, err := client.Sessions.Create(ctx, &sai.SessionOptions{Machine: "m_7f2a"})
if err != nil {
	log.Fatal(err)
}
fmt.Println(session.ID)
```

```java title="Start a new session"
import ai.simular.sai.Sai;
import ai.simular.sai.Session;

Sai sai = new Sai();
Session session = sai.sessions().create("m_7f2a");
```

```csharp title="Start a new session"
using Simular.Sai;

var sai = new SaiClient();
var session = await sai.Sessions.CreateAsync(machine: "m_7f2a");
```

```ruby title="Start a new session"
require "sai"

sai = Sai::Client.new
session = sai.sessions.create(machine: "m_7f2a")
```

| Field       | Required | Notes                                                                                                 |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `machineId` | yes      | The computer whose API conversation (for this API key) to rotate.                                     |
| `channel`   | no       | `api` or `cli`. Omitted, it is `api` for an API key or a Tenant token, `cli` for a signed-in session. |

## Response

```json title="200 OK · New session"
{ "sessionId": "cs_02KQA" }
```

The next `POST /message` with the same API key on this computer lands in this session. Other keys' conversations are not touched.

## Errors

| Status | Body                                                         |
| ------ | ------------------------------------------------------------ |
| `404`  | `{ "error": "Machine not found." }`                          |
| `429`  | More than 200 new sessions in an hour (20 on the free plan). |

## Gotchas

- The `sai` CLI sends `channel: "cli"` to rotate its own conversation; an API caller can omit it.
- You rarely need this. One long conversation per key and computer is the normal shape; rotate when a new task should not see the old context.
- A running task is not stopped by a new session. Call [`/abort`](/documentation/api-reference/abort) first if you want it stopped.
