# Models

GET /v1/agents/models

Lists the models a session can run on, with an `allowed` flag for the caller's plan. Ids from this list go in `model` on [`POST /message`](/documentation/api-reference/message).

## Request

```bash title="List models"
curl -s "$SAI_API_URL/v1/agents/models" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="List models"
from sai import Sai

sai = Sai()
for model in sai.models.list():
    print(model.id, model.allowed)
```

```typescript title="List models"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
for (const model of await sai.models.list()) {
  console.log(model.id, model.allowed)
}
```

```go title="List models"
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
models, err := client.Models.List(ctx)
if err != nil {
	log.Fatal(err)
}
for _, model := range models {
	fmt.Println(model.ID, model.Allowed)
}
```

```java title="List models"
import ai.simular.sai.Model;
import ai.simular.sai.Sai;

Sai sai = new Sai();
for (Model model : sai.models().list()) {
  System.out.println(model.id() + " " + model.allowed());
}
```

```csharp title="List models"
using Simular.Sai;

var sai = new SaiClient();
foreach (var model in await sai.Models.ListAsync())
{
    Console.WriteLine($"{model.Id} {model.Allowed}");
}
```

```ruby title="List models"
require "sai"

sai = Sai::Client.new
sai.models.list.each do |model|
  puts "#{model.id} #{model.allowed}"
end
```

## Response

```json title="200 OK · Models"
{
  "models": [
    {
      "id": "auto",
      "name": "Sai Agent",
      "provider": "anthropic",
      "tier": "balanced",
      "costTier": "$",
      "allowed": true
    },
    {
      "id": "anthropic/claude-sonnet-5",
      "name": "Claude 5 Sonnet",
      "provider": "anthropic",
      "tier": "balanced",
      "costTier": "$$",
      "allowed": true
    },
    {
      "id": "anthropic/claude-opus-5-5",
      "name": "Claude 5.5 Opus",
      "provider": "anthropic",
      "tier": "reasoning",
      "costTier": "$$$",
      "allowed": true
    },
    {
      "id": "google/gemini-3.8-flash",
      "name": "Gemini 3.8 Flash",
      "provider": "google",
      "tier": "fast",
      "costTier": "$",
      "allowed": true
    }
  ],
  "default": "auto"
}
```

The list is longer than shown; the ids above are real.

| Field      | Notes                                                              |
| ---------- | ------------------------------------------------------------------ |
| `id`       | Pass as `model`. `auto` lets Sai pick.                             |
| `name`     | Display name.                                                      |
| `provider` | `anthropic`, `google`, `openai`, `minimax`, `openrouter` or `xai`. |
| `tier`     | `reasoning`, `balanced` or `fast`.                                 |
| `costTier` | `free`, `$`, `$$` or `$$$`. Relative credit cost per task.         |
| `allowed`  | Whether this plan may use it. `auto` is always allowed.            |
| `default`  | The id used when a session has no model set: `auto`.               |

## Free plan

The free plan runs on the Sai agent model only: omit `model` or pass `auto`. Upgrade to a paid plan to choose a model.

`/models` lists every other model with `allowed: false`, and sending one returns `403` from `POST /message`:

```json title="403 Forbidden · model_not_allowed_for_plan"
{
  "error": "model_not_allowed_for_plan",
  "message": "The model \"anthropic/claude-opus-5-5\" is not available on the free plan. The free plan only supports the Sai agent model (\"auto\"); upgrade to a paid plan to choose a model.",
  "allowedModels": ["auto"]
}
```

## Gotchas

- The model is per session and sticks until you pass a different one. You do not need to send `model` on every message.
- `costTier` is relative. Credit charged for a task is shown in the portal.
- Call this once when you need a specific model, not before every task.
