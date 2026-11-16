# Turns

GET /v1/agents/turns/{turnId}, and the turn's trajectory.

Reads the result of one turn. Every [`POST /message`](/documentation/api-reference/message) returns a `turnId`: the turn the message started, or the running turn it joined. See [Structured output](/documentation/concepts/structured-output) for the options that make a turn return typed output.

Authenticate with the same API key as the rest of `/v1/agents`.

## Get a turn

```bash title="Read a turn"
curl -s "$SAI_API_URL/v1/agents/turns/$TURN_ID" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Read a turn"
from sai import Sai

sai = Sai()
record = sai.turns.get("turn_vzjz62w7j7jvOilZ6zBL")
print(record)
```

```typescript title="Read a turn"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const record = await sai.turns.get('turn_vzjz62w7j7jvOilZ6zBL')
console.log(record)
```

```go title="Read a turn"
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
record, err := client.Turns.Get(ctx, "turn_vzjz62w7j7jvOilZ6zBL")
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%+v\n", record)
```

```java title="Read a turn"
import ai.simular.sai.Sai;
import ai.simular.sai.TurnRecord;

Sai sai = new Sai();
TurnRecord record = sai.turns().get("turn_vzjz62w7j7jvOilZ6zBL");
System.out.println(record);
```

```csharp title="Read a turn"
using Simular.Sai;

var sai = new SaiClient();
var record = await sai.Turns.GetAsync("turn_vzjz62w7j7jvOilZ6zBL");
Console.WriteLine(record);
```

```ruby title="Read a turn"
require "sai"

sai = Sai::Client.new
record = sai.turns.get("turn_vzjz62w7j7jvOilZ6zBL")
p record
```

Answers at once. Poll it until `status` is `succeeded` or `failed`; every 2 to 5 seconds is enough.

```json title="200 OK · Turn record"
{
  "turnId": "turn_vzjz62w7j7jvOilZ6zBL",
  "sessionId": "cs_02JAB",
  "machineId": "m_7f2a",
  "status": "failed",
  "output": null,
  "reason_code": "output_invalid",
  "raw_answer": "I found two invoices for September: INV-1043 and INV-1051. The totals were not shown on the list page.",
  "usage": { "inputTokens": 48210, "outputTokens": 1630 },
  "recordTrajectory": false,
  "trajectory": {
    "recorded": false,
    "url": "/v1/agents/turns/turn_vzjz62w7j7jvOilZ6zBL/trajectory"
  },
  "evidence": [],
  "output_errors": ["/invoices/0 must have required property 'total'"],
  "template": "Sign in to the {{vendor}} portal and list the invoices dated in {{month}}.",
  "inputs": { "vendor": "Acme", "month": "September 2026" }
}
```

| Field                | Notes                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `turnId`             | The turn.                                                                                                                                                          |
| `sessionId`          | The session the message landed in. `null` until it is delivered.                                                                                                   |
| `machineId`          | The computer.                                                                                                                                                      |
| `status`             | `running`, `needs_input`, `finalizing`, `succeeded` or `failed`. See [Status](/documentation/concepts/structured-output#status).                                   |
| `output`             | With `output_schema`: an object that matches it. Without: Sai's final answer, a string. `null` until `succeeded`.                                                  |
| `reason_code`        | Set when `failed`: `agent_error`, `aborted` (stopped with [`POST /v1/agents/abort`](/documentation/api-reference/abort) before it answered), `machine_unavailable`, `not_started`, and for a structured message `output_invalid`, `criteria_not_met` or `criteria_unchecked`. |
| `raw_answer`         | Only when `failed`: Sai's final answer (`output_invalid`), or a short explanation.                                                                                 |
| `error_code`         | Only for a known `agent_error`: `insufficient_credits` or `free_computer_time_exhausted`.                                                                          |
| `usage`              | `{ inputTokens, outputTokens }` of Sai's model calls in the turn. `null` until the turn ends.                                                                      |
| `recordTrajectory`   | Whether the turn records its steps.                                                                                                                                |
| `trajectory`         | `{ recorded, url }`: whether any step was stored, and where to read them.                                                                                          |
| `evidence`           | Structured messages only. One entry per check: `{ id, passed, score?, evidence? }`. A string `success_criteria` gives one entry without `id` or `score`.           |
| `output_errors`      | Structured messages only, with `output_invalid`: why the last attempt did not match the schema.                                                                    |
| `template`, `inputs` | Structured messages only: the message as sent, before `{{name}}` was filled, and its values.                                                                       |

The structured fields are extra fields on the same object, so code written for plain messages reads a structured turn unchanged.

## Trajectory

Requires `options.recordTrajectory: true` on the message that started the turn.

```bash title="Read a turn's steps"
curl -s "$SAI_API_URL/v1/agents/turns/$TURN_ID/trajectory" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Read a turn's steps"
from sai import Sai

sai = Sai()
for step in sai.turns.trajectory("turn_vzjz62w7j7jvOilZ6zBL"):
    print(step.index, step.title)
```

```typescript title="Read a turn's steps"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
for (const step of await sai.turns.trajectory('turn_vzjz62w7j7jvOilZ6zBL')) {
  console.log(step.index, step.title)
}
```

```go title="Read a turn's steps"
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
steps, err := client.Turns.Trajectory(ctx, "turn_vzjz62w7j7jvOilZ6zBL")
if err != nil {
	log.Fatal(err)
}
for _, step := range steps {
	fmt.Println(step.Index, step.Title)
}
```

```java title="Read a turn's steps"
import ai.simular.sai.Sai;
import ai.simular.sai.TrajectoryStep;

Sai sai = new Sai();
for (TrajectoryStep step : sai.turns().trajectory("turn_vzjz62w7j7jvOilZ6zBL")) {
  System.out.println(step.index() + " " + step.title());
}
```

```csharp title="Read a turn's steps"
using Simular.Sai;

var sai = new SaiClient();
foreach (var step in await sai.Turns.TrajectoryAsync("turn_vzjz62w7j7jvOilZ6zBL"))
{
    Console.WriteLine($"{step.Index} {step.Title}");
}
```

```ruby title="Read a turn's steps"
require "sai"

sai = Sai::Client.new
sai.turns.trajectory("turn_vzjz62w7j7jvOilZ6zBL").each do |step|
  puts "#{step.index} #{step.title}"
end
```

```json title="200 OK · Trajectory"
{
  "turnId": "turn_vzjz62w7j7jvOilZ6zBL",
  "trajectory": {
    "recorded": true,
    "url": "/v1/agents/turns/turn_vzjz62w7j7jvOilZ6zBL/trajectory"
  },
  "steps": [
    {
      "index": 0,
      "timestamp": "2026-10-10T18:02:11.204Z",
      "title": "Open the Acme portal sign-in page",
      "rationale": "The task starts at the portal, so I open its sign-in page first.",
      "code": "await machine.browser.newtab('https://portal.acme.example/login')",
      "screenshot": "/v1/agents/turns/turn_vzjz62w7j7jvOilZ6zBL/trajectory/screenshots/0"
    },
    {
      "index": 7,
      "final": true,
      "timestamp": "2026-10-10T18:04:52.880Z",
      "screenshot": "/v1/agents/turns/turn_vzjz62w7j7jvOilZ6zBL/trajectory/screenshots/7"
    }
  ]
}
```

| Field        | Notes                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| `index`      | Step number, from 0.                                                   |
| `final`      | `true` on the last entry: the screen when the turn ended.              |
| `title`      | Sai's one-line title for the step.                                     |
| `rationale`  | Sai's reason for the step.                                             |
| `code`       | The code Sai ran.                                                      |
| `error`      | Present when the step failed.                                          |
| `screenshot` | Path of the screen before the step, or `null`. Fetch it with your key. |

`steps` is empty for a turn without `recordTrajectory`. At most 500 steps are listed.

## Screenshot

```bash title="Download a step's screenshot"
curl -s "$SAI_API_URL/v1/agents/turns/$TURN_ID/trajectory/screenshots/$INDEX" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Download a step's screenshot"
from sai import Sai

sai = Sai()
jpeg = sai.turns.screenshot("turn_vzjz62w7j7jvOilZ6zBL", 0)
with open("step-0.jpg", "wb") as f:
    f.write(jpeg)
```

```typescript title="Download a step's screenshot"
import { writeFile } from 'node:fs/promises'
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const jpeg = await sai.turns.screenshot('turn_vzjz62w7j7jvOilZ6zBL', 0)
await writeFile('step-0.jpg', jpeg)
```

```go title="Download a step's screenshot"
import (
	"context"
	"log"
	"os"

	sai "github.com/simular-ai/sai-sdk/go"
)

ctx := context.Background()
client, err := sai.New(sai.Options{})
if err != nil {
	log.Fatal(err)
}
jpeg, err := client.Turns.Screenshot(ctx, "turn_vzjz62w7j7jvOilZ6zBL", 0)
if err != nil {
	log.Fatal(err)
}
if err := os.WriteFile("step-0.jpg", jpeg, 0o644); err != nil {
	log.Fatal(err)
}
```

```java title="Download a step's screenshot"
import ai.simular.sai.Sai;
import java.nio.file.Files;
import java.nio.file.Path;

Sai sai = new Sai();
byte[] jpeg = sai.turns().screenshot("turn_vzjz62w7j7jvOilZ6zBL", 0);
Files.write(Path.of("step-0.jpg"), jpeg);
```

```csharp title="Download a step's screenshot"
using Simular.Sai;

var sai = new SaiClient();
var jpeg = await sai.Turns.ScreenshotAsync("turn_vzjz62w7j7jvOilZ6zBL", 0);
await File.WriteAllBytesAsync("step-0.jpg", jpeg);
```

```ruby title="Download a step's screenshot"
require "sai"

sai = Sai::Client.new
jpeg = sai.turns.screenshot("turn_vzjz62w7j7jvOilZ6zBL", 0)
File.binwrite("step-0.jpg", jpeg)
```

Returns the JPEG (`Content-Type: image/jpeg`).

## Errors

| Status | Body                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404`  | `{ "error": "turn_not_found", "message": "No turn with this id on your account." }`. Also for another account's turn, and for a screenshot that does not exist. |

## Gotchas

- `finalizing` is not done. Keep polling until `succeeded` or `failed`.
- `status: succeeded` without `output_schema` or `success_criteria` only means Sai finished with an answer. Read `output`.
- A message sent while Sai was busy (`queued: true`) joined the running turn, so its `turnId` is that turn's and so is the result.
- A later message in the same session never changes a finished turn.
