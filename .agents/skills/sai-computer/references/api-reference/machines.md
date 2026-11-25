# Machines

GET /v1/agents/machines

Lists the computers on your account.

## Request

```bash title="List your computers"
curl -s "$SAI_API_URL/v1/agents/machines" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="List your computers"
from sai import Sai

sai = Sai()
for machine in sai.machines.list():
    print(machine.id, machine.name, machine.kind, machine.online)
```

```typescript title="List your computers"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
for (const machine of await sai.machines.list()) {
  console.log(machine.id, machine.name, machine.kind, machine.online)
}
```

```go title="List your computers"
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
for _, machine := range machines {
	fmt.Println(machine.ID, machine.Name, machine.Kind, machine.Online)
}
```

```java title="List your computers"
import ai.simular.sai.Machine;
import ai.simular.sai.Sai;

Sai sai = new Sai();
for (Machine machine : sai.machines().list()) {
  System.out.println(machine.id() + " " + machine.name() + " " + machine.kind() + " " + machine.online());
}
```

```csharp title="List your computers"
using Simular.Sai;

var sai = new SaiClient();
foreach (var machine in await sai.Machines.ListAsync())
{
    Console.WriteLine($"{machine.Id} {machine.Name} {machine.Kind} {machine.Online}");
}
```

```ruby title="List your computers"
require "sai"

sai = Sai::Client.new
sai.machines.list.each do |machine|
  puts [machine.id, machine.name, machine.kind, machine.online].join(" ")
end
```

## Response

```json title="200 OK · Computers"
{
  "machines": [
    {
      "machineId": "m_9c1e",
      "name": "Sai cloud computer",
      "updatedAt": 1789990000000,
      "status": "hibernated",
      "canWake": true,
      "kind": "cloud",
      "online": true,
      "os": "windows",
      "capabilities": null
    },
    {
      "machineId": "m_7f2a",
      "name": "Work Desktop",
      "updatedAt": 1790000000000,
      "status": "active",
      "canWake": false,
      "kind": "own",
      "online": true,
      "os": "macOS",
      "capabilities": {
        "canSee": null,
        "canUseAccessibility": null,
        "canControl": null
      }
    }
  ]
}
```

| Field          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `machineId`    | Pass as `machineId` on other calls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `name`         | The name shown in the Sai app. Absent when the computer has none.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `updatedAt`    | Unix time in milliseconds of the last status update.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `status`       | The raw machine status string. Absent when unknown. Prefer `online`.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `canWake`      | Whether `POST /wake` applies to this computer.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `kind`         | `cloud` (hosted by Simular) or `own` (your desktop app).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `online`       | `true` when the computer is `active`, `hibernated` (a message wakes it), or its agent reports online.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `os`           | `windows`, `linux`, `macOS` or `android`. Absent when the computer never reported its platform.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `capabilities` | Whether Sai can see the screen (`canSee`), use other apps' accessibility (`canUseAccessibility`) and control them with the mouse and keyboard (`canControl`), as the computer last reported. Each is `null` when nothing stands in the way, else what does and, where there is one, the fix, such as a permission to turn on. The whole field is `null` while the computer has no answer yet: its app or runner hasn't reported, or is too old to. See [Capabilities](/documentation/organisations/tenant-machines#capabilities). |

Rows are sorted by name.

## Free accounts

A free account whose computer is not claimed right now sees one synthetic row:

```json title="200 OK · Free account, computer not claimed"
{
  "machines": [
    {
      "machineId": "free-3fA9kQ2xYz",
      "name": "Sai cloud computer (free)",
      "updatedAt": 0,
      "canWake": false,
      "kind": "cloud",
      "online": false,
      "capabilities": null
    }
  ]
}
```

`online: false` means the first message will claim and start the computer, which takes about two minutes. While it is claimed, the row is a normal one with the same `machineId`.

> **Note**
>
> `kind`, `online` and the free-account row are available from October 1.

## Create a computer

```bash title="Create a computer"
curl -s "$SAI_API_URL/v1/agents/machines" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Work PC", "os": "linux" }'
```

Creates a Windows or Linux cloud computer for a paid account. It needs a signed-in session: the portal's **Create a Windows computer** and **Create a Linux computer** buttons in the [Playground](https://platform.simular.ai/playground) call it. An API key cannot create a computer, because a computer costs money and is created with the account owner's own checks (plan, payment method, quota, one creation at a time).

The body is optional:

| Field  | Type                     | Description                                        |
| ------ | ------------------------ | -------------------------------------------------- |
| `name` | string, 1–60 characters  | What the computer is called in the app and portal. |
| `os`   | `"windows"` or `"linux"` | The operating system. Defaults to `"windows"`.     |

```json title="202 Accepted · Computer being created"
{
  "taskId": "3f1c…",
  "message": "Creating your computer. It appears in GET /v1/agents/machines within a few minutes."
}
```

Poll `GET /v1/agents/machines` until the new computer is listed with `online: true`, usually within a few minutes.

| Status | `error`                         | When                                                                                       |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `403`  | `session_required`              | Called with an API key. The body carries `createUrl`, the portal page to send the user to. |
| `409`  | `free_plan_computer`            | Free plan. Its computer is the pooled one, started by the first task.                      |
| `429`  | `busy`, or a rate-limit message | A creation is already in progress, or more than 3 in an hour.                              |
| `403`  | `not_billable`                  | The account cannot pay for a computer right now.                                           |

## Live screen

```bash title="Watch a computer's screen"
curl -s -X POST "$SAI_API_URL/v1/agents/machines/$MACHINE_ID/live" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Watch a computer's screen"
from sai import Sai

sai = Sai()
live = sai.machines.live("m_7f2a")
print(live)
```

```typescript title="Watch a computer's screen"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const live = await sai.machines.live('m_7f2a')
console.log(live)
```

```go title="Watch a computer's screen"
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
live, err := client.Machines.Live(ctx, "m_7f2a")
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%+v\n", live)
```

```java title="Watch a computer's screen"
import ai.simular.sai.LiveView;
import ai.simular.sai.Sai;

Sai sai = new Sai();
LiveView live = sai.machines().live("m_7f2a");
System.out.println(live);
```

```csharp title="Watch a computer's screen"
using Simular.Sai;

var sai = new SaiClient();
var live = await sai.Machines.LiveAsync("m_7f2a");
Console.WriteLine(live);
```

```ruby title="Watch a computer's screen"
require "sai"

sai = Sai::Client.new
live = sai.machines.live("m_7f2a")
p live
```

Returns two ways into one of your computers' screens:

- `liveUrl`, a page Simular hosts. Anyone with the link can open it in a browser, without a Simular sign-in. Whoever opens it can use the mouse and keyboard: sign in to a site, solve a captcha. While a Sai turn runs, the page pauses its own input and says **Sai is working**. That pause is only on the page, not enforced by the server. Send it to the person who should act; see [When Sai needs a person](/documentation/concepts/approvals#when-sai-needs-a-person).
- `websocketUrl`, a stream for a viewer of your own: what the [live view](/documentation/coding-agents/live-view) shows. The stream uses [Apache Guacamole](https://guacamole.apache.org/); connect it with its JavaScript client (`Guacamole.WebSocketTunnel` + `Guacamole.Client`). The session takes mouse and keyboard input as well as showing the screen, so a viewer that sends none is view-only.

```json title="200 OK · Live view"
{
  "machineId": "m_9c1e",
  "liveUrl": "https://api.simular.ai/live#t=lp1.…",
  "expiresAt": 1790001800000,
  "websocketUrl": "wss://proxy.vm.api.simular.cloud/guacamole/websocket-tunnel?token=…",
  "width": 1920,
  "height": 1080
}
```

| Field               | Notes                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveUrl`           | The hosted page. Its token is in the URL fragment. Each call returns a new link; earlier ones keep working. Absent where the hosted page is not available yet. |
| `expiresAt`         | Unix time in milliseconds when `liveUrl` stops working and the screen sessions it opened end, 30 minutes after the call. Present with `liveUrl`.             |
| `websocketUrl`      | The Guacamole tunnel, with a session token for that computer.                                                                                                 |
| `width`, `height`   | The screen size in pixels.                                                                                                                                    |

Treat `liveUrl` like a password: whoever has it can watch the screen and use the computer, even while Sai is working. Send it only to the person who should act, and [revoke it](#revoke-live-links) when they are done. If the link expires or is revoked, the page says so; call again for a new one.

`websocketUrl` carries a session token for that computer. Hand it only to your viewer, and get a new one when the stream ends. Split the query string off the URL and pass it to `client.connect()`, because Guacamole appends it itself.

| Status | `error`               | When                                                                         |
| ------ | --------------------- | ---------------------------------------------------------------------------- |
| `404`  |                       | The computer is not yours. A free account may use its own `free-…` computer. |
| `409`  | `machine_not_running` | The computer is asleep or starting. Retry while a task runs.                 |
| `502`  | `live_unavailable`    | The stream could not be set up. Retry later.                                 |
| `429`  |                       | More than 120 requests in an hour.                                           |

The hosted page checks its link when it connects and every few seconds after that. When a check fails, the page stops and tells the person why:

| Status | `error`               | When                                                                              |
| ------ | --------------------- | --------------------------------------------------------------------------------- |
| `401`  | `invalid_link`        | The link expired, was revoked, or was cut short when it was copied.               |
| `404`  |                       | The computer is no longer on this account, or the account can no longer use Sai.  |
| `409`  | `machine_not_running` | The computer is asleep or starting.                                               |
| `429`  |                       | The page reconnected more than 60 times in an hour on this link.                  |
| `502`  | `live_unavailable`    | The screen could not be set up. The page offers **Try again**.                    |

A [Tenant token](/documentation/organisations/tenant-tokens) can open and revoke live screens on the Tenant's machines. An enrolled machine needs the Sai runtime `0.1.2` or later on macOS, or `0.1.3` or later on Windows. See [Live view](/documentation/organisations/runtime#live-view).

## Revoke live links

```bash title="Revoke every live link to a computer"
curl -s -X DELETE "$SAI_API_URL/v1/agents/machines/$MACHINE_ID/live" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

Revokes every `liveUrl` handed out for the computer. `revoked` is how many links it revoked; a computer that is not yours has none, so it answers `0`.

```json title="200 OK · Links revoked"
{
  "machineId": "m_9c1e",
  "revoked": 2
}
```

Revoking also ends the screen sessions those links opened: a page showing the screen loses it and cannot reconnect. That is normally at once; a session that cannot be ended right away is retried and ends within about a minute. `websocketUrl` is not affected: its session ends when its stream closes.

| Status | `error` | When                                   |
| ------ | ------- | -------------------------------------- |
| `400`  |         | `machineId` is not a valid machine id. |
| `429`  |         | More than 120 revocations in an hour.  |
