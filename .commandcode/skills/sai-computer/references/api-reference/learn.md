# Learn (research preview)

POST /v1/agents/learn. Turn recorded turns into Simulang code, or repair that code.

Turns what Sai did in one or more [turns](/documentation/api-reference/turns) into a Simulang function you own, `async function main(params = { ... })`, which your program then runs on a computer through [direct control](/documentation/api-reference/control). Given code you already have, the same call repairs it. With `maxIterations`, it also runs the code on a computer, judges each run and repairs the code until it passes ([learn jobs](#learn-jobs)). [Learned code](/documentation/concepts/learned-code) walks through the whole loop.

Research preview: the request and response may change.

A [Tenant token](/documentation/organisations/tenant-tokens) can call it too, for the Tenant's computers and turns.

Try this first, before the details. With [Sai added to your coding agent](/documentation/coding-agents/claude-code) (Claude Code, Codex or Cursor), ask it:

```prompt title="Prompt"
Use Sai to open TechCrunch, find all AI news published today, write their headlines into Notepad and save the file as techcrunch_headlines.txt, then turn what it did into code I can rerun.
```

## Uses

Two fields decide what a call does: `turns` says where the experience comes from (recorded turns, or else an agent run of `taskTemplate`), and `maxIterations` says how far to go (0, the default, writes the code; 1 or more also runs, judges and repairs it).

| Use                                | Body                                                | What runs                                 | Answer |
| ---------------------------------- | --------------------------------------------------- | ----------------------------------------- | ------ |
| Convert recorded turns to code     | `{ turns }`                                         | convert                                   | `200`  |
| Full algorithm from recorded turns | `{ turns, maxIterations: 3 }`                       | convert, runs, judges, repairs            | `202`  |
| Full algorithm from a task         | `{ taskTemplate, inputs, maxIterations: 3 }`        | agent run, convert, runs, judges, repairs | `202`  |
| Repair code                        | `{ initialCode, evaluations \| guidance \| turns }` | heal                                      | `200`  |

Two more follow from the same rules: `{ taskTemplate, inputs }` runs the agent and returns its code without running it, and `{ initialCode, taskTemplate, inputs, maxIterations: 3 }` runs, judges and repairs code you already have.

A call that only writes code answers `200` with the code. A call that uses the computer (an agent run, or runs of the code) answers `202` with a [learn job](#learn-jobs) to read with `GET`, because it can take an hour.

## Request

```bash title="Learn code from a turn"
curl -s "$SAI_API_URL/v1/agents/learn" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "turns": ["turn_vzjz62w7j7jvOilZ6zBL"],
    "taskTemplate": "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}"
  }'
```

```python title="Learn code from a turn"
from sai import Sai

sai = Sai()
learned = sai.learn.create(
    ["turn_vzjz62w7j7jvOilZ6zBL"],
    task_template="Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
)
print(learned.code)
```

```typescript title="Learn code from a turn"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const learned = await sai.learn.create(['turn_vzjz62w7j7jvOilZ6zBL'], {
  taskTemplate:
    'Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}',
})
console.log(learned.code)
```

```go title="Learn code from a turn"
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
learned, err := client.Learn.Create(ctx, []string{"turn_vzjz62w7j7jvOilZ6zBL"}, &sai.LearnOptions{
	TaskTemplate: "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
})
if err != nil {
	log.Fatal(err)
}
fmt.Println(learned.Code)
```

```java title="Learn code from a turn"
import ai.simular.sai.LearnOptions;
import ai.simular.sai.LearnResult;
import ai.simular.sai.Sai;
import java.util.List;

Sai sai = new Sai();
LearnResult learned = sai.learn().create(List.of("turn_vzjz62w7j7jvOilZ6zBL"), new LearnOptions()
    .taskTemplate(
        "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}"));
System.out.println(learned.code());
```

```csharp title="Learn code from a turn"
using Simular.Sai;

var sai = new SaiClient();
var learned = await sai.Learn.CreateAsync(["turn_vzjz62w7j7jvOilZ6zBL"], new LearnOptions
{
    TaskTemplate =
        "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
});
Console.WriteLine(learned.Code);
```

```ruby title="Learn code from a turn"
require "sai"

sai = Sai::Client.new
learned = sai.learn.create(
  ["turn_vzjz62w7j7jvOilZ6zBL"],
  task_template: "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}"
)
puts learned.code
```

| Field                  | Type            | Required | Default                                                                                  | Notes                                                                                                                                                                                                                                                                |
| ---------------------- | --------------- | -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turns`                | array           | no¹      | None: the agent does `taskTemplate` first                                                | Turn ids from one session, in order, the first one stating the task. Each must have ended and been sent with `options.recordTrajectory: true`. At most 20.                                                                                                           |
| `taskTemplate`         | string          | no¹      | With `turns`: the first turn's template, else one inferred from the first turn's message | The task with `{{name}}` placeholders; each one becomes a parameter. Required without `turns` and `initialCode`, and with `initialCode` when the code is run. Send it when the first turn does not state the whole task.                                             |
| `inputs`               | object          | no       | With `turns`: the first turn's                                                           | A value for every placeholder.                                                                                                                                                                                                                                       |
| `initialCode`          | string          | no       |                                                                                          | Code to repair (with `maxIterations` 0), or to start the run-judge-repair loop from. At most 200 KB.                                                                                                                                                                 |
| `evaluations`          | array           | no       |                                                                                          | How `initialCode` did on runs (below). Needs `initialCode` and `maxIterations` 0. At most 20.                                                                                                                                                                        |
| `guidance`             | string          | no       |                                                                                          | What you know about the task, for writing and repairing the code, e.g. "the Save button is under the ⋯ menu". Never sent to the agent.                                                                                                                               |
| `history`              | string          | no       |                                                                                          | For a repair: what earlier versions of the code changed and how they failed, so the repair does not repeat them. Needs `initialCode` and `maxIterations` 0. At most 20,000 characters.                                                                               |
| `runsWithoutReset`     | boolean         | no       | `false`                                                                                  | For a conversion: the code will be run again and again with no reset in between, so it opens the app or URL itself instead of assuming the screen it starts on. Needs `turns`, no `initialCode`, and `maxIterations` 0. A job sets it itself when it has no `reset`. |
| `maxIterations`        | number          | no       | `0`: only write the code                                                                 | Code versions to run, judge and repair; 3 allows up to two repairs. At most 5.                                                                                                                                                                                       |
| `rollouts`             | number          | no²      | `3`                                                                                      | Runs per code version; a version passes when all of them pass. At most 5.                                                                                                                                                                                            |
| `machineId`            | string          | no²      | Your only cloud computer, else your only own computer                                    | The computer to run on. Required when you have several.                                                                                                                                                                                                              |
| `criteria`             | string or array | no²      | The task as written, with its inputs                                                     | What "done" means for the judge: a sentence, or [checks](/documentation/api-reference/judge).                                                                                                                                                                        |
| `reset`                | object          | no²      | None: each run starts where the last one ended                                           | `{ "code": "..." }` (Simulang) or `{ "task": "..." }` (for the agent), run before the agent run and before every run of the code to put the computer back in its starting state.                                                                                     |
| `judgeInitialAgentRun` | boolean         | no       | `false`                                                                                  | Judge the agent run first, when it answered or reached `agentRunMinutes`; if it fails, the job stops with the judgement and writes no code. Only with an agent run.                                                                                                                                                 |
| `continueWithAgent`    | boolean         | no²      | `false`                                                                                  | After a failed run, the agent finishes the task from where the code stopped; the repair learns from its turn.                                                                                                                                                        |
| `rolloutMinutes`       | number          | no²      | `15`                                                                                     | Time limit of each run of the code.                                                                                                                                                                                                                                  |
| `agentRunMinutes`      | number          | no²      | `15`                                                                                     | Time limit of the agent run and of each reset task.                                                                                                                                                                                                                  |
| `continuationMinutes`  | number          | no²      | `15`                                                                                     | Time limit of each continuation.                                                                                                                                                                                                                                     |
| `maxJobMinutes`        | number          | no²      | `615`                                                                                    | Time limit of the whole job. At most 690.                                                                                                                                                                                                                            |
| `model`                | string          | no       | Sai picks the model                                                                      | An id from [`/models`](/documentation/api-reference/models), for the conversion and repairs. An unknown id is a `400`.                                                                                                                                               |
| `idempotency_key`      | string          | no       |                                                                                          | The same key again returns the earlier result and runs nothing.                                                                                                                                                                                                      |
| `template`, `feedback` | string          | no       |                                                                                          | The old names of `taskTemplate` and `guidance`; still accepted.                                                                                                                                                                                                      |

¹ Send `turns`, `taskTemplate` or `initialCode`. To repair, send `initialCode` with `evaluations`, `guidance` or new `turns`. New turns are the usual input: the code failed on a case, you sent the same template to [`POST /message`](/documentation/api-reference/message) with `recordTrajectory`, Sai solved it, and that turn shows what the code is missing.

² Only for a call that uses the computer; on any other call they are a `400`, so a forgotten `maxIterations` is an error rather than a silent conversion.

`evaluations` is an array of objects, one per run of `initialCode`:

| Field       | Type    | Notes                                                                                                                                          |
| ----------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `inputs`    | object  | The values the code ran with.                                                                                                                  |
| `result`    | object  | The run's [exec result](/documentation/api-reference/control): its `result`, `error` and last `logs`. At most 20 KB; leave the screenshot out. |
| `judgement` | string  | A `judgementId` from [`POST /v1/agents/judge`](/documentation/api-reference/judge); the repair sees its verdict and evidence.                  |
| `passed`    | boolean | Your own verdict.                                                                                                                              |
| `note`      | string  | What went wrong, in your words.                                                                                                                |

```json title="An evaluation"
{
  "inputs": { "newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt" },
  "result": {
    "error": { "kind": "exception", "message": "Error: Notepad did not open" },
    "logs": [
      "Found 13 headlines published today: ...",
      "Launching Notepad...",
      "Task failed: Notepad did not open"
    ]
  },
  "passed": false,
  "note": "Notepad was already open from an earlier run, and its window stayed minimized in the taskbar."
}
```

The call does the work before it answers. How long depends on the task: a longer run gives longer code to write and check. Set your client's timeout to at least 10 minutes. If your side times out, send the same request with the same `idempotency_key`, or read the result with `GET /v1/agents/learn/{learnId}`. A [learn job](#learn-jobs) answers `202` at once instead.

## Response

```json title="200 OK · Learn result"
{
  "learnId": "learn_3Fq9cT1kZ0aJ",
  "mode": "convert",
  "status": "succeeded",
  "title": "Save today's TechCrunch AI headlines to Notepad",
  "template": "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
  "parameters": [
    { "name": "newsSite", "defaultValue": "TechCrunch" },
    { "name": "topic", "defaultValue": "AI" },
    { "name": "fileName", "defaultValue": "techcrunch_headlines.txt" }
  ],
  "code": "async function main(params = { newsSite: \"TechCrunch\", topic: \"AI\", fileName: \"techcrunch_headlines.txt\" }) {\n  ...\n}",
  "validation": { "errors": [], "warnings": [] },
  "sourceTurns": ["turn_vzjz62w7j7jvOilZ6zBL"],
  "usage": { "inputTokens": 80670, "outputTokens": 4525 },
  "researchPreview": true
}
```

| Field          | Notes                                                                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`         | `convert`, `heal`, or `policyIteration` for a job that runs the code.                                                                                                                                       |
| `title`        | A short name for the code, a few words long, written by the model.                                                                                                                                          |
| `status`       | Whether the call did its work: `succeeded`, or `failed` when it wrote no code (e.g. `validation.errors` is not empty). A job also has `running` and `stopped`.                                              |
| `template`     | The template used or inferred. Send it to `POST /message` with `options.inputs` when the code fails and you want Sai to take over.                                                                          |
| `parameters`   | The keys of `main`'s `params`, with the values from the source turn as defaults.                                                                                                                            |
| `code`         | The function. It uses the bound `machine`, throws `needs_sign_in: <site or app>` when a sign-in is needed and `precondition_failed: ...` when it starts on the wrong screen, and returns the task's answer. |
| `outputSchema` | When the source turn had an `output_schema`: what `main` returns.                                                                                                                                           |
| `validation`   | Static checks on the code: `errors` (an unused or unknown parameter, code that does not parse, a call direct control does not allow, a ref id or coordinate copied from the trajectory) and `warnings`.     |
| `changes`      | For `heal`: what changed and why.                                                                                                                                                                           |
| `usage`        | Tokens of the model calls this request made, billed to your account.                                                                                                                                        |
| `testResult`   | How the code did when it was run: `status` (`not_judged`, `passed` or `failed`), `passedRuns`, `requiredRuns` and the `inputs` every run used. `not_judged` when nothing ran it.                            |

A repeated `idempotency_key` returns the earlier result plus `"idempotent_replay": true`.

## Run the code

Run it in a [control lease](/documentation/api-reference/control) with the call to `main` as the block's last line; the block's result is what `main` returns. Pass every input: an argument to `main` replaces its whole default object, so merge your inputs over `parameters`' defaults.

Learned code reads your account's clock: the timezone your Sai app last reported, or UTC if you have never opened it. A learn job's runs and a control lease both use it, so `new Date()` gives the same day when you replay the code as when the job tested it.

```bash title="Run learned code in a lease"
curl -s "$SAI_API_URL/v1/machines/$MACHINE_ID/control/exec" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "<code>\nawait main({\"newsSite\": \"TechCrunch\", \"topic\": \"Fintech\", \"fileName\": \"techcrunch_fintech.txt\"})",
    "timeoutMs": 300000
  }'
```

```python title="Run learned code in a lease"
from sai import Sai

sai = Sai()
learned = sai.learn.get("learn_3Fq9cT1kZ0aJ")
with sai.control.open("m_7f2a") as lease:
    r = lease.run(learned, {"newsSite": "TechCrunch", "topic": "Fintech", "fileName": "techcrunch_fintech.txt"}, timeout_ms=300000)
    print(r.result)
```

```typescript title="Run learned code in a lease"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const learned = await sai.learn.get('learn_3Fq9cT1kZ0aJ')
const lease = await sai.control.open({ machine: 'm_7f2a' })
try {
  const r = await lease.run(
    learned,
    { newsSite: 'TechCrunch', topic: 'Fintech', fileName: 'techcrunch_fintech.txt' },
    { timeoutMs: 300_000 },
  )
  console.log(r.result)
} finally {
  await lease.close()
}
```

```go title="Run learned code in a lease"
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
learned, err := client.Learn.Get(ctx, "learn_3Fq9cT1kZ0aJ")
if err != nil {
	log.Fatal(err)
}
lease, err := client.Control.Open(ctx, "m_7f2a")
if err != nil {
	log.Fatal(err)
}
defer lease.Close(ctx)
r, err := lease.Run(ctx, learned,
	map[string]any{"newsSite": "TechCrunch", "topic": "Fintech", "fileName": "techcrunch_fintech.txt"},
	&sai.ExecOptions{Timeout: 5 * time.Minute},
)
if err != nil {
	log.Fatal(err)
}
fmt.Println(r.Result)
```

```java title="Run learned code in a lease"
import ai.simular.sai.ControlLease;
import ai.simular.sai.ExecResult;
import ai.simular.sai.LearnResult;
import ai.simular.sai.Sai;
import java.time.Duration;
import java.util.Map;

Sai sai = new Sai();
LearnResult learned = sai.learn().get("learn_3Fq9cT1kZ0aJ");
try (ControlLease lease = sai.control().open("m_7f2a")) {
  ExecResult r = lease.run(
      learned,
      Map.of("newsSite", "TechCrunch", "topic", "Fintech", "fileName", "techcrunch_fintech.txt"),
      Duration.ofMinutes(5));
  System.out.println(r.result());
}
```

```csharp title="Run learned code in a lease"
using Simular.Sai;

var sai = new SaiClient();
var learned = await sai.Learn.GetAsync("learn_3Fq9cT1kZ0aJ");
await using var lease = await sai.Control.OpenAsync("m_7f2a");
var r = await lease.RunAsync(
    learned,
    new Dictionary<string, object> { ["newsSite"] = "TechCrunch", ["topic"] = "Fintech", ["fileName"] = "techcrunch_fintech.txt" },
    timeout: TimeSpan.FromMinutes(5));
Console.WriteLine(r.Result);
```

```ruby title="Run learned code in a lease"
require "sai"

sai = Sai::Client.new
learned = sai.learn.get("learn_3Fq9cT1kZ0aJ")
sai.control.open(machine: "m_7f2a") do |lease|
  r = lease.run(learned, { "newsSite" => "TechCrunch", "topic" => "Fintech", "fileName" => "techcrunch_fintech.txt" },
                timeout_ms: 300_000)
  p r.result
end
```

> **Note**
>
> `<code>` is a placeholder: put the `code` string from the learn response in its place, then a newline and the call to `main`.

The SDKs do this for you: `lease.run(learned, inputs)`.

## Learn jobs

A call that uses the computer is a job. It answers at once:

```json title="202 Accepted · Learn job"
{ "learnId": "learn_LIEHFGsRU4H3", "mode": "policyIteration", "status": "running" }
```

```bash title="Start a learn job from a task"
curl -s "$SAI_API_URL/v1/agents/learn" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "taskTemplate": "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
    "inputs": { "newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt" },
    "criteria": "techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
    "maxIterations": 3,
    "rollouts": 3
  }'
```

```python title="Start a learn job from a task"
from sai import Sai

sai = Sai()
job = sai.learn.create(
    task_template="Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
    inputs={"newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt"},
    criteria="techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
    max_iterations=3,
    rollouts=3,
)
done = sai.learn.wait(job)
print(done.status, done.test_result, done.code)
```

```typescript title="Start a learn job from a task"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const job = await sai.learn.create([], {
  taskTemplate:
    'Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}',
  inputs: { newsSite: 'TechCrunch', topic: 'AI', fileName: 'techcrunch_headlines.txt' },
  criteria:
    'techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs',
  maxIterations: 3,
  rollouts: 3,
})
const done = await sai.learn.wait(job)
console.log(done.status, done.testResult, done.code)
```

```go title="Start a learn job from a task"
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
job, err := client.Learn.Create(ctx, nil, &sai.LearnOptions{
	TaskTemplate:  "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
	Inputs:        map[string]any{"newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt"},
	Criteria:      sai.CriteriaText("techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs"),
	MaxIterations: 3,
	Rollouts:      3,
})
if err != nil {
	log.Fatal(err)
}
done, err := client.Learn.Wait(ctx, job.ID, nil)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%s %+v\n%s\n", done.Status, done.TestResult, done.Code)
```

```java title="Start a learn job from a task"
import ai.simular.sai.LearnOptions;
import ai.simular.sai.LearnResult;
import ai.simular.sai.Sai;
import java.util.List;
import java.util.Map;

Sai sai = new Sai();
LearnResult job = sai.learn().create(List.of(), new LearnOptions()
    .taskTemplate(
        "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}")
    .inputs(Map.of("newsSite", "TechCrunch", "topic", "AI", "fileName", "techcrunch_headlines.txt"))
    .criteria(
        "techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs")
    .maxIterations(3)
    .rollouts(3));
LearnResult done = sai.learn().waitFor(job);
System.out.println(done.status() + " " + done.testResult() + " " + done.code());
```

```csharp title="Start a learn job from a task"
using Simular.Sai;

var sai = new SaiClient();
var job = await sai.Learn.CreateAsync([], new LearnOptions
{
    TaskTemplate =
        "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
    Inputs = new Dictionary<string, object> { ["newsSite"] = "TechCrunch", ["topic"] = "AI", ["fileName"] = "techcrunch_headlines.txt" },
    Criteria =
        "techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
    MaxIterations = 3,
    Rollouts = 3,
});
var done = await sai.Learn.WaitAsync(job);
Console.WriteLine($"{done.Status} {done.TestResult} {done.Code}");
```

```ruby title="Start a learn job from a task"
require "sai"

sai = Sai::Client.new
job = sai.learn.create(
  task_template: "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
  inputs: { "newsSite" => "TechCrunch", "topic" => "AI", "fileName" => "techcrunch_headlines.txt" },
  criteria: "techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
  max_iterations: 3,
  rollouts: 3
)
done = sai.learn.wait(job)
p done.status, done.test_result, done.code
```

What the job does:

1. **Reset**, when you sent one, then the **agent run**, when you sent no `turns`. A run that stopped at a question or failed on its own stops the job here (`agent_failed`, or `machine_unavailable`), with `agentRunEnd` saying why and nothing converted: fix the task, or send its `agentTurnId` as `turns` to convert it anyway. A run the account could not pay for stops the job too (`insufficient_credit`). Any other run goes on, even one that got the task wrong or was cut off at `agentRunMinutes`: the runs and repairs fix the rest. With `judgeInitialAgentRun`, that run is judged first, and if it fails, the job stops here (`agent_failed`) with the judgement; send its `agentTurnId` as `turns` to start again from it if you disagree with the judge.
2. **Convert** the run (or your `turns`) into version 1. With `maxIterations` 0 the job ends here.
3. For each version, **run** the code up to `rollouts` times in a row, each after the reset, and **judge** each run on what it returned, its logs, the screen when it ended, and the date and time it started on your account's clock (so "today" in a task means the day the run saw). The first failed run ends that version's runs.
4. If every run passed, the job ends `succeeded`. Otherwise, with `continueWithAgent`, the agent finishes the task from where the code stopped; then the code is **repaired** with the failed run, its judgement, the agent's turn and `guidance`, and the next version runs. After the last version, the job ends `succeeded` with `testResult.status: "failed"`.

Nobody watches a job, so it approves like a [control lease](/documentation/api-reference/control): in the agent run, resets and code runs, commands and clicks that would ask for [approval](/documentation/concepts/approvals) go ahead, and a sign-in, a choice or a connect request fails at once instead of waiting. On your own computer, that is your real screen, mouse and keyboard.

A step that fails for a reason that may pass (a `429` or `5xx`, a dropped connection, a judge or model call that gave no answer, the computer not free yet) is tried two more times before the job stops.

Read it with `GET /v1/agents/learn/{learnId}` every 10 to 30 seconds. The SDKs' `wait` does this for you:

```bash title="Read a learn job"
curl -s "$SAI_API_URL/v1/agents/learn/$LEARN_ID" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Read a learn job"
from sai import Sai

sai = Sai()
job = sai.learn.get("learn_LIEHFGsRU4H3")
print(job.status, job.progress)
```

```typescript title="Read a learn job"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const job = await sai.learn.get('learn_LIEHFGsRU4H3')
console.log(job.status, job.progress)
```

```go title="Read a learn job"
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
job, err := client.Learn.Get(ctx, "learn_LIEHFGsRU4H3")
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%s %+v\n", job.Status, job.Progress)
```

```java title="Read a learn job"
import ai.simular.sai.LearnResult;
import ai.simular.sai.Sai;

Sai sai = new Sai();
LearnResult job = sai.learn().get("learn_LIEHFGsRU4H3");
System.out.println(job.status() + " " + job.progress());
```

```csharp title="Read a learn job"
using Simular.Sai;

var sai = new SaiClient();
var job = await sai.Learn.GetAsync("learn_LIEHFGsRU4H3");
Console.WriteLine($"{job.Status} {job.Progress}");
```

```ruby title="Read a learn job"
require "sai"

sai = Sai::Client.new
job = sai.learn.get("learn_LIEHFGsRU4H3")
p job.status, job.progress
```

```json title="200 OK · A learn job, still running"
{
  "learnId": "learn_LIEHFGsRU4H3",
  "mode": "policyIteration",
  "status": "running",
  "progress": { "step": "run", "iteration": 1, "rollout": 2 }
}
```

When `status` is no longer `running`, the job has ended:

```json title="200 OK · A learn job that ended"
{
  "learnId": "learn_LIEHFGsRU4H3",
  "mode": "policyIteration",
  "status": "succeeded",
  "testResult": {
    "status": "passed",
    "passedRuns": 3,
    "requiredRuns": 3,
    "inputs": { "newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt" }
  },
  "version": 2,
  "code": "async function main(params = { newsSite: \"TechCrunch\", topic: \"AI\", fileName: \"techcrunch_headlines.txt\" }) {\n  ...\n}",
  "agentTurnId": "turn_mklL8pNHaL59",
  "iterations": [
    {
      "index": 1,
      "learnId": "learn_lkP4",
      "passed": 1,
      "runs": 2,
      "rollouts": [
        {
          "index": 1,
          "verdict": "passed",
          "reset": { "kind": "code", "ok": true, "durationMs": 900 }
        },
        {
          "index": 2,
          "verdict": "failed",
          "summary": "It returned the second story.",
          "continuationTurnId": "turn_ED6M"
        }
      ]
    },
    {
      "index": 2,
      "learnId": "learn_OoPe",
      "changes": "...",
      "passed": 3,
      "runs": 3,
      "rollouts": ["..."]
    }
  ]
}
```

| Field                             | Notes                                                                                                                                                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`                          | `running`, `succeeded` (the job did everything asked), `failed` (it wrote no code) or `stopped` (it ended early; see `stopReason`).                                                                                                                                               |
| `stopReason`                      | `cancelled`, `time_limit`, `agent_failed` (the agent run stopped at a question or failed, see `agentRunEnd`, or it failed `judgeInitialAgentRun`; no code), `blocked` (the code threw `needs_sign_in` or `precondition_failed`), `reset_failed`, `learn_failed`, `model_error`, `insufficient_credit`, `machine_unavailable` or `interrupted`. A stopped job still returns the latest code it has. |
| `message`                         | One sentence on why it stopped.                                                                                                                                                                                                                                                   |
| `progress`                        | While it runs: `{ step, iteration, rollout }`, with `step` one of `reset`, `agent`, `convert`, `run`, `judge`, `continue`, `repair`.                                                                                                                                              |
| `testResult`                      | How the returned code did, on `inputs` only.                                                                                                                                                                                                                                      |
| `version`                         | Which iteration `code` is from.                                                                                                                                                                                                                                                   |
| `agentRunEnd`                     | How the agent run ended when it gave no answer; absent when it answered. `time_limit`: it reached `agentRunMinutes`; the code is still converted and tested, but code from an unfinished run is often unreliable, so raise the limit. `needs_input`: it asked a question, which nobody answers in a job, so make the task say what to do. Both are stopped by the job, so the turn reads `reason_code: aborted`. Otherwise the turn's own `reason_code`, e.g. `agent_error`. Every end but `time_limit` stops the job before conversion: fix the agent run first. |
| `agentTurnId`                     | The job's agent run: an ordinary [turn](/documentation/api-reference/turns), with its trajectory.                                                                                                                                                                                 |
| `agentRunReset`, `agentJudgement` | The reset before the agent run, and the judgement of the agent run (`judgeInitialAgentRun`).                                                                                                                                                                                      |
| `iterations`                      | One entry per version: the `learnId` of the convert or heal that wrote it (`GET` it for that version's code), `changes`, `passed`, `runs` and `rollouts`.                                                                                                                         |
| `rollouts[]`                      | `verdict` (`passed`, `failed`, `error`, or `stopped` when the job stopped during the run, with `stopReason` saying why; none while the run is going), `reset` (`{ kind, ok, durationMs }`), `result`, `error`, `durationMs`, `judgementId`, `summary`, `continuationTurnId`.      |

Read one run, with what it returned and logged and its judgement:

```bash title="Read a run of a learn job"
curl -s "$SAI_API_URL/v1/agents/learn/$LEARN_ID/iterations/1/rollouts/2" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Read a run of a learn job"
run = sai.learn.rollout("learn_LIEHFGsRU4H3", 1, 2)
print(run.run, run.judgement)
```

```typescript title="Read a run of a learn job"
const run = await sai.learn.rollout('learn_LIEHFGsRU4H3', 1, 2)
console.log(run.run, run.judgement)
```

```go title="Read a run of a learn job"
run, err := client.Learn.Rollout(ctx, "learn_LIEHFGsRU4H3", 1, 2)
if err != nil {
	log.Fatal(err)
}
fmt.Println(run.Run, run.Judgement)
```

```java title="Read a run of a learn job"
var run = sai.learn().rollout("learn_LIEHFGsRU4H3", 1, 2);
System.out.println(run.run() + " " + run.judgement());
```

```csharp title="Read a run of a learn job"
var run = await sai.Learn.RolloutAsync("learn_LIEHFGsRU4H3", 1, 2);
Console.WriteLine($"{run.Run} {run.Judgement}");
```

```ruby title="Read a run of a learn job"
run = sai.learn.rollout("learn_LIEHFGsRU4H3", 1, 2)
p run.run, run.judgement
```

Stop a job at once, whatever step it is on. It keeps the last complete results, reads `stopped` with `stopReason: "cancelled"` within seconds, and frees the computer:

```bash title="Cancel a learn job"
curl -s -X POST "$SAI_API_URL/v1/agents/learn/$LEARN_ID/cancel" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Cancel a learn job"
sai.learn.cancel("learn_LIEHFGsRU4H3")
```

```typescript title="Cancel a learn job"
await sai.learn.cancel('learn_LIEHFGsRU4H3')
```

```go title="Cancel a learn job"
if err := client.Learn.Cancel(ctx, "learn_LIEHFGsRU4H3"); err != nil {
	log.Fatal(err)
}
```

```java title="Cancel a learn job"
sai.learn().cancel("learn_LIEHFGsRU4H3");
```

```csharp title="Cancel a learn job"
await sai.Learn.CancelAsync("learn_LIEHFGsRU4H3");
```

```ruby title="Cancel a learn job"
sai.learn.cancel("learn_LIEHFGsRU4H3")
```

> **Note**
>
> The runs do the task for real, up to `maxIterations` × `rollouts` times, plus the agent run and continuations. Use test inputs or a test account for a task that sends or submits something. The computer is busy for the whole job.

**Time limits.** Each step has a limit (`rolloutMinutes`, `agentRunMinutes`, `continuationMinutes`, and 5 minutes for `reset.code`), and the job has `maxJobMinutes`. Before it starts, the job's worst case (every step at its limit, every version failing on its last run) must fit in `maxJobMinutes`; otherwise the call is refused with `time_limit_too_low` and the computed worst case. Reaching `maxJobMinutes` stops the job at once with `stopReason: "time_limit"` and the last complete results.

The limits' maxima cannot all be used at once. The worst case is:

```text
[reset + agent run, with an agent run] + 2 for the initial judge + 5 for the conversion (none from initialCode)
  + maxIterations × (rollouts × (reset + rolloutMinutes + 2) + continuationMinutes)
  + (maxIterations − 1) × 5 for the repairs
```

with 15 for a reset task (`agentRunMinutes`), 5 for reset code, 2 for each judge call and 5 for each conversion or repair. With every default, 5 versions × 3 runs, a reset task, the initial judge and continuations come to 612 minutes, which is why `maxJobMinutes` defaults to 615. The longest job the API accepts is one whose worst case fits in 690 minutes; 5 versions × 5 runs with all of the above comes to 932 and is refused, so lower `rollouts` or the step limits for it. The main uses with defaults need far less: 20 minutes for an agent run converted to code, 183 for the full loop from a task with `maxIterations: 3`.

Every model call a job makes is billed to your account, as the same calls would be when made one by one. If the account runs out of credit at any step, the job stops with `insufficient_credit` and returns its latest code.

## Read a result later

```bash title="Read a learn result"
curl -s "$SAI_API_URL/v1/agents/learn/$LEARN_ID" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Read a learn result"
from sai import Sai

sai = Sai()
learned = sai.learn.get("learn_3Fq9cT1kZ0aJ")
print(learned.status)
```

```typescript title="Read a learn result"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const learned = await sai.learn.get('learn_3Fq9cT1kZ0aJ')
console.log(learned.status)
```

```go title="Read a learn result"
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
learned, err := client.Learn.Get(ctx, "learn_3Fq9cT1kZ0aJ")
if err != nil {
	log.Fatal(err)
}
fmt.Println(learned.Status)
```

```java title="Read a learn result"
import ai.simular.sai.LearnResult;
import ai.simular.sai.Sai;

Sai sai = new Sai();
LearnResult learned = sai.learn().get("learn_3Fq9cT1kZ0aJ");
System.out.println(learned.status());
```

```csharp title="Read a learn result"
using Simular.Sai;

var sai = new SaiClient();
var learned = await sai.Learn.GetAsync("learn_3Fq9cT1kZ0aJ");
Console.WriteLine(learned.Status);
```

```ruby title="Read a learn result"
require "sai"

sai = Sai::Client.new
learned = sai.learn.get("learn_3Fq9cT1kZ0aJ")
puts learned.status
```

Returns the same object. A call that stopped mid-way reads as `failed` with `error: "interrupted"`. A job whose computer stopped answering reads as `stopped` with `stopReason: "interrupted"`.

## Errors

| Status | Body                                                                                                                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Validation failed: no `turns`, `taskTemplate` or `initialCode`; a computer field (`rollouts`, `reset`, …) on a call that does not use the computer; `evaluations` with `maxIterations`; `initialCode` with `maxIterations` but no `taskTemplate`; an unknown key or model. |
| `400`  | `{ "error": "mixed_sessions" }`: the turns come from more than one session.                                                                                                                                                                                                |
| `400`  | `{ "error": "template_mismatch" }`: the template does not match the first turn's message.                                                                                                                                                                                  |
| `400`  | `{ "error": "no_steps" }`: the turns have no agent steps to convert.                                                                                                                                                                                                       |
| `400`  | `{ "error": "invalid_template" }`: an input is missing or unused. `time_limit_too_low`: the job's worst case is above `maxJobMinutes`. `machine_required`: you have several computers and sent no `machineId`.                                                             |
| `402`  | `{ "error": "model_refused", "message": "Out of credits. ..." }`                                                                                                                                                                                                           |
| `403`  | `{ "error": "model_refused" }`: your plan does not allow the model; pass another `model`. `own_computer_access_off`: a learn job on your own computer, which is off until you [turn it on](/documentation/concepts/computers#turn-on-code-on-your-own-computer). For a Tenant's enrolled machine, the Organisation [turns it on](/documentation/organisations/tenants#own-computers).                                                                                                                                                                                  |
| `404`  | `{ "error": "turn_not_found" }`, `{ "error": "judgement_not_found" }`, or `learn_not_found` on `GET`.                                                                                                                                                                      |
| `409`  | `{ "error": "turn_not_finished" }` or `{ "error": "trajectory_not_recorded" }`.                                                                                                                                                                                            |
| `409`  | `{ "error": "machine_busy" }`: a learn job is already running on the computer.                                                                                                                                                                                             |
| `429`  | More than 30 learn calls in an hour, more than 10 learn jobs in a day, or the model is rate limited.                                                                                                                                                                       |
| `502`  | `{ "error": "model_output_invalid" }` or `learn_failed`: try again.                                                                                                                                                                                                        |
