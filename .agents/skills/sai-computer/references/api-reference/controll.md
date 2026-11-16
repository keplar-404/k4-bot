# Control

/v1/machines/{machineId}/control — open, run code on, interrupt and close direct control of a machine.

The endpoints behind [direct control](/documentation/concepts/direct-control) (research preview). Control is a lease on one machine, so it lives under the machine:

```text title="Base URL"
https://api.simular.ai/v1/machines/{machineId}/control
```

`machineId` is one of your computers, cloud or your own, from [`GET /v1/agents/machines`](/documentation/api-reference/machines). You hold at most one lease per machine, so there is no separate id: the machine is the handle.

Every call carries `Authorization: Bearer sapi_...`, as everywhere else, or a [Tenant token](/documentation/organisations/tenant-tokens) to drive a Tenant's computers. See [Authentication](/documentation/api-reference/authentication).

## Open

```bash title="Open control of a computer"
curl -s -X POST "$SAI_API_URL/v1/machines/$MACHINE_ID/control" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Open control of a computer"
from sai import Sai

sai = Sai()
lease = sai.control.open("m_7f2a")
```

```typescript title="Open control of a computer"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const lease = await sai.control.open({ machine: 'm_7f2a' })
```

```go title="Open control of a computer"
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
lease, err := client.Control.Open(ctx, "m_7f2a")
if err != nil {
	log.Fatal(err)
}
defer lease.Close(ctx)
```

```java title="Open control of a computer"
import ai.simular.sai.ControlLease;
import ai.simular.sai.Sai;

Sai sai = new Sai();
ControlLease lease = sai.control().open("m_7f2a");
```

```csharp title="Open control of a computer"
using Simular.Sai;

var sai = new SaiClient();
var lease = await sai.Control.OpenAsync("m_7f2a");
```

```ruby title="Open control of a computer"
require "sai"

sai = Sai::Client.new
lease = sai.control.open(machine: "m_7f2a")
```

No body.

```json title="201 Created · Lease"
{ "machineId": "m_7f2a", "expiresAfterIdleSec": 600 }
```

Answers `201` once the lease holds the computer. If a Sai task holds it, or the computer has to start, that can take up to three minutes. If you already hold an open lease on the machine, it answers `200` at once with the same body.

A lease whose computer stopped answering (for example, the service behind it was restarted abruptly) still looks open to this call. The first exec that gets no answer closes it with `410 control_closed` and reason `unresponsive`, and the next open starts a fresh lease.

### Who can use a lease

A lease belongs to the credential that opened it: one API key, or your signed-in session in the Playground. Exec, interrupt and get with any other credential answer `404 control_not_open`, as if no lease were open; so does close, except for the account owner (below). Opening with another API key answers `409 machine_busy` with a `holder` until the lease is closed or has been idle for about 30 minutes:

```json title="409 Conflict · machine_busy"
{
  "error": "machine_busy",
  "message": "API key sapi_…a1b2 has control of this computer. Try again once it closes its lease or the lease goes idle. The account owner can also close or take over the lease while signed in.",
  "holder": { "type": "api_key", "last4": "a1b2" }
}
```

`holder.type` is `api_key` (with `last4`, `null` for older keys) or `playground`.

The account owner, signed in with their Sai account rather than an API key, can always take a lease back: opening control closes another credential's lease with reason `closed_by_owner` and starts a fresh one, and close ends any lease on the machine. An API key cannot do either. After a takeover, the key that held the lease gets `404 control_not_open` on its next call (the machine's lease is now the owner's); after the owner closes it, the key gets `410 control_closed` with reason `closed_by_owner`.

## Exec

```bash title="Run code in a lease"
curl -s "$SAI_API_URL/v1/machines/$MACHINE_ID/control/exec" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "var r = await machine.exec({ command: '\''hostname'\'' }); r.stdout.trim()",
    "timeoutMs": 60000
  }'
```

```python title="Run code in a lease"
from sai import Sai

sai = Sai()
with sai.control.open("m_7f2a") as lease:
    r = lease.exec(
        "var r = await machine.exec({ command: 'hostname' }); r.stdout.trim()",
        timeout_ms=60000,
    )
    print(r.result)
```

```typescript title="Run code in a lease"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const lease = await sai.control.open({ machine: 'm_7f2a' })
try {
  const r = await lease.exec(
    "var r = await machine.exec({ command: 'hostname' }); r.stdout.trim()",
    { timeoutMs: 60_000 },
  )
  console.log(r.result)
} finally {
  await lease.close()
}
```

```go title="Run code in a lease"
import (
	"context"
	"fmt"
	"log"
	"time"

	sai "github.com/simular-ai/sai-sdk/go"
)

ctx := context.Background()
client, err := sai.New(sai.Options{})
if err != nil {
	log.Fatal(err)
}
lease, err := client.Control.Open(ctx, "m_7f2a")
if err != nil {
	log.Fatal(err)
}
defer lease.Close(ctx)
r, err := lease.Exec(ctx,
	"var r = await machine.exec({ command: 'hostname' }); r.stdout.trim()",
	&sai.ExecOptions{Timeout: 60 * time.Second},
)
if err != nil {
	log.Fatal(err)
}
fmt.Println(r.Result)
```

```java title="Run code in a lease"
import ai.simular.sai.ControlLease;
import ai.simular.sai.ExecResult;
import ai.simular.sai.Sai;
import java.time.Duration;

Sai sai = new Sai();
try (ControlLease lease = sai.control().open("m_7f2a")) {
  ExecResult r = lease.exec(
      "var r = await machine.exec({ command: 'hostname' }); r.stdout.trim()",
      Duration.ofSeconds(60));
  System.out.println(r.result());
}
```

```csharp title="Run code in a lease"
using Simular.Sai;

var sai = new SaiClient();
await using var lease = await sai.Control.OpenAsync("m_7f2a"); // closed at the end of the scope
var r = await lease.ExecAsync(
    "var r = await machine.exec({ command: 'hostname' }); r.stdout.trim()",
    timeout: TimeSpan.FromSeconds(60));
Console.WriteLine(r.Result);
```

```ruby title="Run code in a lease"
require "sai"

sai = Sai::Client.new
sai.control.open(machine: "m_7f2a") do |lease|
  r = lease.exec(
    "var r = await machine.exec({ command: 'hostname' }); r.stdout.trim()",
    timeout_ms: 60_000
  )
  puts r.result
end
```

| Field       | Required | Notes                                                                |
| ----------- | -------- | -------------------------------------------------------------------- |
| `code`      | yes      | Simulang (JavaScript). Up to 200,000 characters.                     |
| `timeoutMs` | no       | How long the block may run. Default 120,000, min 1,000, max 300,000. |

Any other field, or a value out of range, answers `400 invalid_body`.

```json title="200 OK · Exec result"
{
  "result": "WIN-CLOUD-7F2A",
  "logs": [],
  "observations": {},
  "variables": [
    { "name": "r", "type": "object", "preview": "{ stdout: 'WIN-CLOUD-7F2A\\r\\n', … }" }
  ],
  "durationMs": 412
}
```

| Field                     | Notes                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `result`                  | The block's last expression as JSON. A snapshot comes back as its outline text. Over 256 KB, it is truncated to a string.                                    |
| `logs`                    | Console output, oldest first. Up to 200 lines of 2,000 characters.                                                                                           |
| `error`                   | Present when the block did not finish: `{ kind, message }`.                                                                                                  |
| `observations.screenshot` | `{ base64, mimeType }`. Present only when this block captured the screen. If it was too large to return, `observations.screenshotOmitted` is `true` instead. |
| `variables`               | `[{ name, type, preview }]` for every variable the REPL holds.                                                                                               |
| `durationMs`              | How long the block ran.                                                                                                                                      |

A block that throws is still a `200`. Read `error.kind`:

| `kind`        | Meaning                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `exception`   | The code threw. Variables set before the throw are kept.                                                               |
| `timeout`     | The block ran past `timeoutMs` and was stopped, or it waited past `timeoutMs` behind an earlier block and did not run. |
| `interrupted` | You called interrupt.                                                                                                  |

A stopped block normally keeps the REPL's variables. A block that does not stop within a few seconds of a timeout or interrupt is ended by restarting the REPL, and the earlier variables are gone.

Blocks run one at a time, in the order they arrive. A second exec sent while one is running waits for it, and that wait counts toward its own `timeoutMs`.

If the lease has ended, exec answers `410 control_closed` with a `reason`:

| `reason`       | Meaning                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `closed`       | You closed it.                                                                                       |
| `idle_timeout` | It sat idle and released the computer.                                                               |
| `lock_lost`    | A Sai task took the computer while the lease was quiet.                                              |
| `unresponsive` | The computer did not answer within the block's `timeoutMs` plus 30 seconds, so the lease was closed. |
| `shutdown`     | The service behind the lease restarted.                                                              |
| `closed_by_owner` | The account owner closed it while signed in.                                                      |

```json title="410 Gone · control_closed"
{
  "error": "control_closed",
  "message": "The computer stopped answering, so this control lease was closed. Open a new one.",
  "reason": "unresponsive"
}
```

Open control again for a fresh lease. With no lease on the machine at all, exec answers `404 control_not_open`.

## Interrupt

```bash title="Interrupt the running block"
curl -s -X POST "$SAI_API_URL/v1/machines/$MACHINE_ID/control/interrupt" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Interrupt the running block"
from sai import Sai

sai = Sai()
lease = sai.control.open("m_7f2a")
print(lease.interrupt())
```

```typescript title="Interrupt the running block"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const lease = await sai.control.open({ machine: 'm_7f2a' })
console.log(await lease.interrupt())
```

```go title="Interrupt the running block"
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
lease, err := client.Control.Open(ctx, "m_7f2a")
if err != nil {
	log.Fatal(err)
}
defer lease.Close(ctx)
interrupted, err := lease.Interrupt(ctx)
if err != nil {
	log.Fatal(err)
}
fmt.Println(interrupted)
```

```java title="Interrupt the running block"
import ai.simular.sai.ControlLease;
import ai.simular.sai.Sai;

Sai sai = new Sai();
ControlLease lease = sai.control().open("m_7f2a");
System.out.println(lease.interrupt());
```

```csharp title="Interrupt the running block"
using Simular.Sai;

var sai = new SaiClient();
var lease = await sai.Control.OpenAsync("m_7f2a");
Console.WriteLine(await lease.InterruptAsync());
```

```ruby title="Interrupt the running block"
require "sai"

sai = Sai::Client.new
lease = sai.control.open(machine: "m_7f2a")
p lease.interrupt
```

Stops the running block at its next step or loop iteration. Its exec answers with `error.kind: "interrupted"`.

```json title="202 Accepted · Block interrupted"
{ "interrupted": true }
```

`false` means nothing was running. Answers `202`.

## Get

```bash title="Read the lease"
curl -s "$SAI_API_URL/v1/machines/$MACHINE_ID/control" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Read the lease"
from sai import Sai

sai = Sai()
lease = sai.control.open("m_7f2a")
print(lease.get())
```

```typescript title="Read the lease"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const lease = await sai.control.open({ machine: 'm_7f2a' })
console.log(await lease.get())
```

```go title="Read the lease"
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
lease, err := client.Control.Open(ctx, "m_7f2a")
if err != nil {
	log.Fatal(err)
}
defer lease.Close(ctx)
state, err := lease.Get(ctx)
if err != nil {
	log.Fatal(err)
}
fmt.Println(state)
```

```java title="Read the lease"
import ai.simular.sai.ControlLease;
import ai.simular.sai.Sai;

Sai sai = new Sai();
ControlLease lease = sai.control().open("m_7f2a");
System.out.println(lease.get());
```

```csharp title="Read the lease"
using Simular.Sai;

var sai = new SaiClient();
var lease = await sai.Control.OpenAsync("m_7f2a");
Console.WriteLine(await lease.GetAsync());
```

```ruby title="Read the lease"
require "sai"

sai = Sai::Client.new
lease = sai.control.open(machine: "m_7f2a")
p lease.get
```

Your latest lease on the machine, open or closed.

```json title="200 OK · Lease"
{
  "machineId": "m_7f2a",
  "status": "open",
  "createdAt": 1791273600000,
  "lastExecAt": 1791273712000,
  "expiresAfterIdleSec": 600
}
```

A closed lease has `status: "closed"` and a `closedReason`, one of the exec `reason` values above. `createdAt` and `lastExecAt` are milliseconds since the epoch; `lastExecAt` is `null` before the first block. A lease that failed to open never replaces the one shown here. `404 control_not_open` if you never opened control on the machine.

## Close

```bash title="Close the lease"
curl -s -X DELETE "$SAI_API_URL/v1/machines/$MACHINE_ID/control" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Close the lease"
from sai import Sai

sai = Sai()
lease = sai.control.open("m_7f2a")
lease.close()
```

```typescript title="Close the lease"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const lease = await sai.control.open({ machine: 'm_7f2a' })
await lease.close()
```

```go title="Close the lease"
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
lease, err := client.Control.Open(ctx, "m_7f2a")
if err != nil {
	log.Fatal(err)
}
if err := lease.Close(ctx); err != nil {
	log.Fatal(err)
}
```

```java title="Close the lease"
import ai.simular.sai.ControlLease;
import ai.simular.sai.Sai;

Sai sai = new Sai();
ControlLease lease = sai.control().open("m_7f2a");
lease.close();
```

```csharp title="Close the lease"
using Simular.Sai;

var sai = new SaiClient();
var lease = await sai.Control.OpenAsync("m_7f2a");
await lease.CloseAsync();
```

```ruby title="Close the lease"
require "sai"

sai = Sai::Client.new
lease = sai.control.open(machine: "m_7f2a")
lease.close
```

Clears the REPL and releases the computer. Answers `204`, also when no lease is open. Always close when you are done: until then, Sai's tasks on that computer wait.

## Errors

Error bodies are `{ "error": "<code>", "message": "..." }`.

| Status | `error`                                                 | When                                                                                     |
| ------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `400`  | `invalid_machine`                                       | The `machineId` in the path is malformed.                                                |
| `400`  | `machine_not_supported`                                 | The computer runs its own Sai agent, so the API cannot drive it.                         |
| `400`  | `invalid_body`                                          | Exec: a missing or unknown field, or a value out of range. `details` lists the problems. |
| `403`  | `forbidden`                                             | Open: the computer refused this account.                                                 |
| `403`  | `own_computer_access_off`                               | Open: your own computer, and code on it is off. [Turn it on](/documentation/concepts/computers#turn-on-code-on-your-own-computer). For a Tenant's enrolled machine, the Organisation [turns it on](/documentation/organisations/tenants#own-computers). |
| `403`  | `phone_verification_required`, `phone_allowance_in_use` | Free plan: verify a phone number in the Sai app first.                                   |
| `403`  | `spend_cap_reached`                                     | Open: the API key reached its monthly spend limit. Carries `resetsAt`. See [Spend limits](/documentation/concepts/billing-and-limits#spend-limits). |
| `404`  | `machine_not_found`                                     | Not yours, or does not exist.                                                            |
| `404`  | `control_not_open`                                      | No lease on this machine. Open one first.                                                |
| `409`  | `machine_busy`                                          | A Sai task or another lease holds the computer. Honor `Retry-After` when set.            |
| `409`  | `machine_busy` with `holder`                            | Open: another API key or the Playground holds the lease. See [Who can use a lease](#who-can-use-a-lease). |
| `409`  | `not_free_tier`                                         | Open on the free computer, but the account is no longer on the free plan.                |
| `410`  | `control_closed`                                        | The lease has ended; `reason` says why (see [Exec](#exec)). Open control again.          |
| `429`  | `budget_exhausted`                                      | Free plan: today's computer time is used up. Resets at midnight UTC.                     |
| `429`  | `rate_limited`                                          | More than 30 leases opened, or 3,000 blocks run, in an hour.                             |
| `502`  | `dispatcher_unavailable`                                | Open: Sai could not reach the computer. Retry shortly.                                   |
| `503`  | `machine_unavailable`, `no_capacity`                    | Open: the computer did not come online in time. Honor `Retry-After`.                     |

## Gotchas

- `new Date()` reads your account's clock: the timezone your Sai app last reported, or UTC if you have never opened it, the same clock a learn job's runs use. Use `toISOString()` or the `getUTC*` methods when you need UTC.
- `var`, not `let` or `const`, for anything you want in the next block.
- Screenshots are base64 in the JSON. Decode before saving; do not log them.
- The free plan's computer is deleted when the lease closes: copy out anything you need first.
- Every exec counts as activity. A lease you stop using releases the computer after 10 minutes, or 2 when a Sai task is waiting for it.
