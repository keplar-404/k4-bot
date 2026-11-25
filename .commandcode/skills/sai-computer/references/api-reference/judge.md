# Judge (research preview)

POST /v1/agents/judge. Check recorded turns against criteria you choose now.

Checks what Sai did in one or more [turns](/documentation/api-reference/turns) against criteria you choose now, without running anything again. Use it to check old runs against a new rule, or to get evidence for [repairing learned code](/documentation/api-reference/learn). A judgement never changes the turns it judged.

Research preview: the request and response may change.

## Request

```bash title="Judge a turn"
curl -s "$SAI_API_URL/v1/agents/judge" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "turns": ["turn_vzjz62w7j7jvOilZ6zBL"],
    "criteria": [
      {
        "id": "title",
        "check": "The agent reported the title of the top story",
        "returnEvidence": true
      }
    ]
  }'
```

```python title="Judge a turn"
from sai import Check, Sai

sai = Sai()
judgement = sai.judge.create(
    ["turn_vzjz62w7j7jvOilZ6zBL"],
    [Check("title", "The agent reported the title of the top story", return_evidence=True)],
)
print(judgement.verdict)
```

```typescript title="Judge a turn"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const judgement = await sai.judge.create(
  ['turn_vzjz62w7j7jvOilZ6zBL'],
  [{ id: 'title', check: 'The agent reported the title of the top story', returnEvidence: true }],
)
console.log(judgement.verdict)
```

```go title="Judge a turn"
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
judgement, err := client.Judge.Create(ctx,
	[]string{"turn_vzjz62w7j7jvOilZ6zBL"},
	sai.Checks{{ID: "title", Check: "The agent reported the title of the top story", ReturnEvidence: true}},
	nil,
)
if err != nil {
	log.Fatal(err)
}
fmt.Println(judgement.Verdict)
```

```java title="Judge a turn"
import ai.simular.sai.Check;
import ai.simular.sai.Judgement;
import ai.simular.sai.Sai;
import java.util.List;

Sai sai = new Sai();
Judgement judgement = sai.judge().create(
    List.of("turn_vzjz62w7j7jvOilZ6zBL"),
    List.of(new Check("title", "The agent reported the title of the top story", true)));
System.out.println(judgement.verdict());
```

```csharp title="Judge a turn"
using Simular.Sai;

var sai = new SaiClient();
var judgement = await sai.Judge.CreateAsync(
    ["turn_vzjz62w7j7jvOilZ6zBL"],
    new[] { new Check("title", "The agent reported the title of the top story", ReturnEvidence: true) });
Console.WriteLine(judgement.Verdict);
```

```ruby title="Judge a turn"
require "sai"

sai = Sai::Client.new
judgement = sai.judge.create(
  ["turn_vzjz62w7j7jvOilZ6zBL"],
  [Sai::Check.new(id: "title", check: "The agent reported the title of the top story", return_evidence: true)]
)
puts judgement.verdict
```

| Field             | Type            | Required | Notes                                                                                                                                              |
| ----------------- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turns`           | array           | yes      | Turn ids from one session, judged together as one task. Each must have ended. At most 20.                                                          |
| `criteria`        | string or array | yes      | A sentence for a model to judge against (at most 4,000 characters), or up to 20 checks `{ id, check, returnEvidence? }`, as in `success_criteria`. |
| `task`            | string          | no       | The task to judge against. Default: the first turn's message.                                                                                      |
| `judges`          | object          | no       | `{ criteria: true }`. Step-by-step judging of screenshots (`transitions`) and checking a live computer (`probe`) come later and return `400`.      |
| `idempotency_key` | string          | no       | The same key again returns the earlier judgement.                                                                                                  |

The judge reads the turns' steps, their output and the final answers. It does not see screenshots yet.

## Response

```json title="200 OK · Judgement"
{
  "judgementId": "judgement_8LmQ2rT0bV",
  "verdict": "passed",
  "summary": "1 of 1 checks passed.",
  "task": "Open https://news.ycombinator.com and read the title of the top story",
  "criteria": [
    {
      "id": "title",
      "check": "The agent reported the title of the top story",
      "verdict": "passed",
      "score": 0.97,
      "evidence": "The final answer gives the title \"Show HN: ...\" read from the front page."
    }
  ],
  "turns": ["turn_vzjz62w7j7jvOilZ6zBL"],
  "usage": { "inputTokens": 5120, "outputTokens": 140 },
  "researchPreview": true
}
```

| Field      | Notes                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verdict`  | `passed`, `failed`, or `unverifiable` when a criterion could not be checked.                                                                             |
| `criteria` | One entry per criterion. `score` is the probability that a check holds; `evidence` is always set for a sentence and, for a check, with `returnEvidence`. |
| `usage`    | Tokens of the judge's model calls, billed to your account.                                                                                               |

Treat the verdict as advice: text on the screen can try to steer a model judge.

## Read a judgement later

```bash title="Read a judgement"
curl -s "$SAI_API_URL/v1/agents/judge/$JUDGEMENT_ID" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Read a judgement"
from sai import Sai

sai = Sai()
judgement = sai.judge.get("judgement_8LmQ2rT0bV")
print(judgement)
```

```typescript title="Read a judgement"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const judgement = await sai.judge.get('judgement_8LmQ2rT0bV')
console.log(judgement)
```

```go title="Read a judgement"
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
judgement, err := client.Judge.Get(ctx, "judgement_8LmQ2rT0bV")
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%+v\n", judgement)
```

```java title="Read a judgement"
import ai.simular.sai.Judgement;
import ai.simular.sai.Sai;

Sai sai = new Sai();
Judgement judgement = sai.judge().get("judgement_8LmQ2rT0bV");
System.out.println(judgement);
```

```csharp title="Read a judgement"
using Simular.Sai;

var sai = new SaiClient();
var judgement = await sai.Judge.GetAsync("judgement_8LmQ2rT0bV");
Console.WriteLine(judgement);
```

```ruby title="Read a judgement"
require "sai"

sai = Sai::Client.new
judgement = sai.judge.get("judgement_8LmQ2rT0bV")
p judgement
```

## Errors

| Status | Body                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| `400`  | Validation failed, `mixed_sessions`, or `not_supported` for `transitions` and `probe`. |
| `402`  | Not enough credits.                                                                    |
| `404`  | `{ "error": "turn_not_found" }`, or `judgement_not_found` on `GET`.                    |
| `409`  | `{ "error": "turn_not_finished" }`.                                                    |
| `429`  | More than 120 judge calls in an hour.                                                  |
