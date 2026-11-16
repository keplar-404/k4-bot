# Account

GET /v1/agents/account

Returns the plan and spendable credit of the account behind the key. Use it to decide whether to start a task, or to explain a task that stopped for lack of credits.

## Request

```bash title="Read your plan and credit"
curl -s "$SAI_API_URL/v1/agents/account" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Read your plan and credit"
from sai import Sai

sai = Sai()
account = sai.account.get()
print(account)
```

```typescript title="Read your plan and credit"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const account = await sai.account.get()
console.log(account)
```

```go title="Read your plan and credit"
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

```java title="Read your plan and credit"
import ai.simular.sai.Account;
import ai.simular.sai.Sai;

Sai sai = new Sai();
Account account = sai.account().get();
System.out.println(account);
```

```csharp title="Read your plan and credit"
using Simular.Sai;

var sai = new SaiClient();
var account = await sai.Account.GetAsync();
Console.WriteLine(account);
```

```ruby title="Read your plan and credit"
require "sai"

sai = Sai::Client.new
account = sai.account.get
p account
```

## Response

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

| Field            | Notes                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userId`         | The account id. Also the `uid` in `approvalUrl`.                                                                                                                 |
| `userState`      | The account state string. `null` when unknown.                                                                                                                   |
| `plan.id`        | The subscription plan id. `null` on the free plan.                                                                                                               |
| `plan.title`     | A display name: `Free`, `Sai Subscription`, `Sai Premium Subscription`, `Sai Unlimited Subscription`, `Sai Pay As You Go`. An unknown plan id is returned as is. |
| `plan.free`      | `true` on the free plan.                                                                                                                                         |
| `plan.unlimited` | `true` on the unlimited plan.                                                                                                                                    |
| `credits`        | `{ "usd": number }`. `null` when Billing could not be reached; the rest of the response is still filled.                                                         |
| `credits.usd`    | Spendable credit in US dollars, two decimals. `null` on the unlimited plan.                                                                                      |
| `authType`       | `apiKey` or `firebase`.                                                                                                                                          |

A free account:

```json title="200 OK · Free account"
{
  "userId": "3fA9kQ2xYz",
  "userState": "active_free",
  "plan": { "id": null, "title": "Free", "free": true, "unlimited": false },
  "credits": { "usd": 0.35 },
  "authType": "apiKey"
}
```

## Gotchas

- The call never fails because Billing is down. Check `credits` for `null` before reading `credits.usd`.
- Credit is what a task can spend now. A free account's daily grant refills it; the portal shows when.
- The Billing lookup has a five-second timeout, so this call can take a moment. Do not put it inside the poll loop.
