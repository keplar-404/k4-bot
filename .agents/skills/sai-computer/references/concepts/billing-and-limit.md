# Billing and limits

What a request costs, what a free account gets, and the rate limits.

## Billing

Sai is credit-based. Each task draws credits from your account. The computer and the model are included; you do not bring your own model keys and there is nothing to configure.

- **Free accounts** get one pooled Windows cloud computer, a daily time limit on it, and a daily credit grant. Tasks run on the Sai agent model (`auto`); choosing a model needs a paid plan. Phone verification is required before the first API key. The exact daily figures are shown in the portal.
- **Paid accounts** get their own computers, a larger credit balance and top-ups.

Upgrade at [platform.simular.ai](https://platform.simular.ai).

## Check your balance

`GET /v1/agents/account` returns the plan and the credit a task can spend right now.

```bash title="Check your balance"
curl -s "$SAI_API_URL/v1/agents/account" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Check your balance"
from sai import Sai

sai = Sai()
print(sai.account.get())
```

```typescript title="Check your balance"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
console.log(await sai.account.get())
```

```go title="Check your balance"
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
account, err := client.Account.Get(ctx)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%+v\n", account)
```

```java title="Check your balance"
import ai.simular.sai.Sai;

Sai sai = new Sai();
System.out.println(sai.account().get());
```

```csharp title="Check your balance"
using Simular.Sai;

var sai = new SaiClient();
Console.WriteLine(await sai.Account.GetAsync());
```

```ruby title="Check your balance"
require "sai"

sai = Sai::Client.new
p sai.account.get
```

```json title="200 OK · Account"
{
  "userId": "3fA9kQ2xYz",
  "userState": "active",
  "plan": {
    "id": "sai_subscription",
    "title": "Sai Subscription",
    "free": false,
    "unlimited": false
  },
  "credits": { "usd": 12.4 },
  "authType": "apiKey"
}
```

`credits` is `null` when Billing cannot be reached, and `credits.usd` is `null` on the unlimited plan. When a task ends with an insufficient-credits error, this call tells you whether to top up or wait for the free plan's daily grant. See [Account](/documentation/api-reference/account).

## When you run out

A task that stops for lack of credits or computer time ends with an `error` or `tool-output-error` event carrying a `code`:

| `code`                         | What happened                                                                                                                                                          | What to do                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `insufficient_credits`         | No spendable credit. On the free plan, the event's `resetsAt` is the next UTC midnight, when the daily credits refresh. A paid account or a Tenant gets no `resetsAt`. | Free: wait for `resetsAt`. Paid: top up at [platform.simular.ai](https://platform.simular.ai). |
| `free_computer_time_exhausted` | The free plan's daily computer time is spent and the workspace shut down. It resets daily; the Sai app shows the local time.                                           | Free: come back tomorrow, or upgrade. Do not retry today.                                      |

```json title="insufficient_credits error event"
{
  "type": "error",
  "errorText": "insufficient_credits: your free credits for today are used up.",
  "code": "insufficient_credits",
  "resetsAt": "2026-09-30T00:00:00.000Z"
}
```

Neither error is retryable today. Stop the loop, report it, and check `GET /account` if you want the numbers. See [Events](/documentation/api-reference/events#error-codes).

## Spend limits

Spend limits are rolling out and may not be available on your account yet.

Each API key can carry a monthly spend limit, set by the account owner in the portal or with [`PATCH /v1/account/keys/{keyId}`](/documentation/api-reference/keys#update-a-key). It counts the key's model and tool spend per calendar month in UTC; computer time is not counted. Once a key reaches its limit, requests made with it are refused with `403`, not with an insufficient-credits error, because the account itself may still have credit:

```json title="403 Forbidden · spend_cap_reached"
{
  "error": "spend_cap_reached",
  "scope": "api_key",
  "message": "This API key has reached its monthly cap on model and tool spend. ...",
  "resetsAt": "2026-11-01T00:00:00.000Z"
}
```

`resetsAt` is the start of the next UTC month. Raising or removing the limit reopens the key sooner. Do not retry: stop, and report it. The SDKs raise `SpendCapReachedError`.

`POST /message` and opening control check the limit before they start anything. The limit is soft: calls already running when it is reached finish, so a key can go slightly past it. When a key calls a model provider route directly, the `403` comes in that provider's error format, with `spend_cap_reached` as its code.

Organisations can also give each Tenant a monthly budget on its model and tool spend. A Tenant at its budget gets the same `403 spend_cap_reached`, with `scope` set to `tenant` instead of `api_key`. See [Tenant budgets](/documentation/organisations/tenants#budgets).

## Models

Each task runs on the session's model. The default, `auto`, lets Sai pick. `GET /v1/agents/models` lists the catalog with an `allowed` flag per plan; the free plan is limited to an allowlist. Pass `model` on `POST /message` to change it. See [Models](/documentation/api-reference/models).

## Rate limits

Limits apply per account on a rolling one-hour window, shared across every client (API keys, the CLI, the desktop app). Exceeding one returns `429` with an `error` string. Back off and retry after a minute.

| Action               | Limit                                    |
| -------------------- | ---------------------------------------- |
| `POST /message`      | 600 per hour on a paid plan, 60 on free  |
| `POST /upload`       | 30 per hour, 25 MB per file              |
| `POST /abort`        | 20 per hour                              |
| `POST /new-session`  | 200 per hour on a paid plan, 20 on free  |
| `POST /approve`      | 20 per minute                            |
| `POST /account/keys` | 5 per hour                               |
| `GET /events`        | 1200 per hour; `wait` at most 60 seconds |

Polling `/events` with `wait=0` in a tight loop hits its limit in twenty minutes. Long-poll with `wait=30` or more and the same hour costs about a hundred calls.

## Key limits

| Plan | Live keys per account |
| ---- | --------------------- |
| Free | 1                     |
| Paid | 20                    |

Creating a key past the limit returns `422`. Revoke one in the portal first.

## Storage

Uploads count against your account's file storage. When it is full, `POST /upload` returns `409` with `{ "error": "storage_quota_exceeded" }`. The quota is shown in the portal.

Where storage above the free part is paid from the balance, an upload that needs it returns `402` with `{ "error": "storage_balance_insufficient" }` when the balance doesn't cover it, and `503` with `{ "error": "storage_balance_unavailable" }` when the balance can't be checked. Retry a `503` later.
