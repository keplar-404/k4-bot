# Authentication

Bearer API keys on every request.

Every request carries an API key in the `Authorization` header.

```text title="Authorization header"
Authorization: Bearer sapi_...
```

Keys start with `sapi_`. Create them in the portal at [platform.simular.ai](https://platform.simular.ai). A key is shown once at creation; store it in a secret manager or an environment variable, never in source.

## Check a key

```bash title="Check a key"
curl -s "$SAI_API_URL/v1/agents/auth" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Check a key"
from sai import Sai

sai = Sai()
me = sai.auth.check()
print(me.user_id, me.auth_type)  # apiKey
```

```typescript title="Check a key"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const me = await sai.auth.check()
console.log(me.userId, me.authType) // apiKey
```

```go title="Check a key"
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
me, err := client.Auth.Check(ctx)
if err != nil {
	log.Fatal(err)
}
fmt.Println(me.UserID, me.AuthType) // apiKey
```

```java title="Check a key"
import ai.simular.sai.AuthInfo;
import ai.simular.sai.Sai;

Sai sai = new Sai();
AuthInfo me = sai.auth().check();
System.out.println(me.userId() + " " + me.authType()); // apiKey
```

```csharp title="Check a key"
using Simular.Sai;

var sai = new SaiClient();
var me = await sai.Auth.CheckAsync();
Console.WriteLine($"{me.UserId} {me.AuthType}"); // apiKey
```

```ruby title="Check a key"
require "sai"

sai = Sai::Client.new
me = sai.auth.check
puts me.user_id, me.auth_type # apiKey
```

```json title="200 OK · Who the key acts as"
{ "ok": true, "userId": "3fA9kQ2xYz", "authType": "apiKey" }
```

A missing or revoked key returns `401`.

## Firebase ID tokens

The same endpoints also accept a Firebase ID token from a signed-in Sai session in the `Authorization` header. That is how the portal and the `sai` CLI call the API. Key management under `/v1/account/keys` accepts only a Firebase session; an API key cannot create, list or revoke keys. See [Keys](/documentation/api-reference/keys).

## Organisation Keys and Tenant tokens

An [Organisation](/documentation/organisations) has keys of its own. They also start with `sapi_`, but they manage [Tenants](/documentation/organisations/tenants) and cannot run tasks. To run tasks for a Tenant, exchange the Organisation Key for a [Tenant token](/documentation/organisations/tenant-tokens) and send that in `Authorization` instead.

## Who can use a key

- Paid accounts: any live key on the account.
- Free accounts: one key, after phone verification. Before verification, key creation returns `403` with `{ "error": "phone_verification_required" }`. The check reads the sign-in token, so verify the phone first and then sign in; if you verified it just now, sign in again before creating the key.

> **Note**
>
> Free-account keys are available from October 1. Today's staging accepts API keys from paid accounts only.

## Errors

| Status | Meaning                                                                             |
| ------ | ----------------------------------------------------------------------------------- |
| `401`  | No credential, or the key is unknown or revoked.                                    |
| `403`  | The key is valid but the account may not do this (plan, ownership).                 |
| `429`  | A rate limit. See [Billing and limits](/documentation/concepts/billing-and-limits). |

Error bodies are JSON with one `error` string:

```json title="429 Too Many Requests · Rate limited"
{ "error": "Message rate limit exceeded. Maximum 600 messages per hour." }
```
