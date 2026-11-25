# Learned code (research preview)

Turn what Sai did into Simulang code you own, run it without the agent, and repair it when it breaks.

Sai solves a task by looking at the screen and deciding each step. Once it has solved a task, you can turn what it did into a Simulang function and run that function again with new inputs, without the agent. The code is faster and cheaper to run, and you can read it, test it and keep it under version control. When the code breaks, Sai repairs it from what went wrong.

Try this first, before the details. With [Sai added to your coding agent](/documentation/coding-agents/claude-code) (Claude Code, Codex or Cursor), ask it:

```prompt title="Prompt"
Use Sai to open TechCrunch, find all AI news published today, write their headlines into Notepad and save the file as techcrunch_headlines.txt, then turn what it did into code I can rerun.
```

The loop has four calls. You can run each one yourself, or [let the API run the full algorithm](#let-sai-run-the-loop):

1. **Record.** Send the task to [`POST /message`](/documentation/api-reference/message) with `options.recordTrajectory: true`, ideally as a template with inputs, so the inputs are named:

   ```bash title="Record a task"
   curl -s "$SAI_API_URL/v1/agents/message" \
     -H "Authorization: Bearer $SAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
       "options": {
         "inputs": { "newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt" },
         "recordTrajectory": true
       },
       "wait": false
     }'
   ```

   ```python title="Record a task"
   from sai import Evaluation, Sai

   sai = Sai()
   pc = sai.machines.list()[0]
   session = sai.sessions.create(machine=pc)
   turn = session.send(
       "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
       inputs={"newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt"},
       record_trajectory=True,
   )
   print(turn.id)
   ```

   ```typescript title="Record a task"
   import { Sai } from '@simular-ai/sai-sdk'

   const sai = new Sai()
   const [pc] = await sai.machines.list()
   const session = await sai.sessions.create({ machine: pc })
   const turn = await session.send(
     'Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}',
     {
       inputs: { newsSite: 'TechCrunch', topic: 'AI', fileName: 'techcrunch_headlines.txt' },
       recordTrajectory: true,
     },
   )
   console.log(turn.id)
   ```

   ```go title="Record a task"
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
   pc := machines[0]
   session, err := client.Sessions.Create(ctx, &sai.SessionOptions{Machine: pc.ID})
   if err != nil {
   	log.Fatal(err)
   }
   turn, err := session.Send(ctx,
   	"Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
   	&sai.SendOptions{
   		Inputs:           map[string]any{"newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt"},
   		RecordTrajectory: true,
   	},
   )
   if err != nil {
   	log.Fatal(err)
   }
   fmt.Println(turn.ID)
   ```

   ```java title="Record a task"
   import ai.simular.sai.Evaluation;
   import ai.simular.sai.LearnOptions;
   import ai.simular.sai.Machine;
   import ai.simular.sai.Sai;
   import ai.simular.sai.SendOptions;
   import ai.simular.sai.Session;
   import ai.simular.sai.Turn;
   import java.util.List;
   import java.util.Map;

   Sai sai = new Sai();
   Machine pc = sai.machines().list().get(0);
   Session session = sai.sessions().create(pc);
   Turn turn = session.send(
       "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
       new SendOptions()
           .inputs(Map.of("newsSite", "TechCrunch", "topic", "AI", "fileName", "techcrunch_headlines.txt"))
           .recordTrajectory(true));
   System.out.println(turn.id());
   ```

   ```csharp title="Record a task"
   using Simular.Sai;

   var sai = new SaiClient();
   var pc = (await sai.Machines.ListAsync())[0];
   var session = await sai.Sessions.CreateAsync(machine: pc);
   var turn = await session.SendAsync(
       "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
       new SendOptions
       {
           Inputs = new Dictionary<string, object> { ["newsSite"] = "TechCrunch", ["topic"] = "AI", ["fileName"] = "techcrunch_headlines.txt" },
           RecordTrajectory = true,
       });
   Console.WriteLine(turn.Id);
   ```

   ```ruby title="Record a task"
   require "sai"

   sai = Sai::Client.new
   pc = sai.machines.list.first
   session = sai.sessions.create(machine: pc)
   turn = session.send(
     "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
     inputs: { "newsSite" => "TechCrunch", "topic" => "AI", "fileName" => "techcrunch_headlines.txt" },
     record_trajectory: true
   )
   puts turn.id
   ```

2. **Learn.** [`POST /v1/agents/learn`](/documentation/api-reference/learn) with the turn's id returns `async function main(params = { newsSite: "...", topic: "...", fileName: "..." })`, the template and the parameters. A clarification you sent during the task, or a follow-up turn, can be included by listing its turn too.
3. **Run.** Open a [control lease](/documentation/api-reference/control) and run the code with new inputs: `await main({ "newsSite": "TechCrunch", "topic": "Fintech", "fileName": "techcrunch_fintech.txt" })` as the block's last line. The block's result is what `main` returns. The code throws `needs_sign_in: <site>` when the computer is not signed in, and `precondition_failed: ...` when it starts on the wrong screen.
4. **Judge and repair.** Check a run yourself, or with [`POST /v1/agents/judge`](/documentation/api-reference/judge). When it failed, call `learn` again with the code as `initialCode` and the run as an evaluation. If the code cannot handle a case at all, send the template to `POST /message` with those inputs, let Sai solve it, and pass that new turn to `learn`: the repair adds what the code was missing.

In the SDKs:

```python title="Learn, run and repair"
learned = sai.learn.create([turn])
with sai.control.open(machine=pc) as lease:
    r = lease.run(learned, {"newsSite": "TechCrunch", "topic": "Fintech", "fileName": "techcrunch_fintech.txt"})
    if not r.ok:
        learned = sai.learn.create(
            initial_code=learned.code,
            evaluations=[Evaluation(inputs={"newsSite": "TechCrunch", "topic": "Fintech", "fileName": "techcrunch_fintech.txt"}, result=r, passed=False)],
        )
```

```typescript title="Learn, run and repair"
let learned = await sai.learn.create([turn])
const lease = await sai.control.open({ machine: pc })
try {
  const r = await lease.run(learned, {
    newsSite: 'TechCrunch',
    topic: 'Fintech',
    fileName: 'techcrunch_fintech.txt',
  })
  if (!r.ok) {
    learned = await sai.learn.create([], {
      initialCode: learned.code,
      evaluations: [
        {
          inputs: { newsSite: 'TechCrunch', topic: 'Fintech', fileName: 'techcrunch_fintech.txt' },
          result: r,
          passed: false,
        },
      ],
    })
  }
} finally {
  await lease.close()
}
```

```go title="Learn, run and repair"
learned, err := client.Learn.Create(ctx, []string{turn.ID}, nil)
if err != nil {
	log.Fatal(err)
}
lease, err := client.Control.Open(ctx, pc.ID)
if err != nil {
	log.Fatal(err)
}
defer lease.Close(ctx)
inputs := map[string]any{"newsSite": "TechCrunch", "topic": "Fintech", "fileName": "techcrunch_fintech.txt"}
r, err := lease.Run(ctx, learned, inputs, nil)
if err != nil {
	log.Fatal(err)
}
if !r.OK {
	learned, err = client.Learn.Create(ctx, nil, &sai.LearnOptions{
		InitialCode: learned.Code,
		Evaluations: []sai.Evaluation{{Inputs: inputs, Result: r, Passed: sai.Ptr(false)}},
	})
	if err != nil {
		log.Fatal(err)
	}
}
fmt.Println(learned.Code)
```

```java title="Learn, run and repair"
var learned = sai.learn().create(List.of(turn));
try (var lease = sai.control().open(pc)) {
  var r = lease.run(learned, Map.of("newsSite", "TechCrunch", "topic", "Fintech", "fileName", "techcrunch_fintech.txt"));
  if (!r.ok()) {
    learned = sai.learn().create(List.of(), new LearnOptions()
        .initialCode(learned.code())
        .evaluations(List.of(
            new Evaluation(Map.of("newsSite", "TechCrunch", "topic", "Fintech", "fileName", "techcrunch_fintech.txt"))
                .result(r)
                .passed(false))));
  }
}
```

```csharp title="Learn, run and repair"
var learned = await sai.Learn.CreateAsync([turn]);
await using var lease = await sai.Control.OpenAsync(pc);
var inputs = new Dictionary<string, object>
{
    ["newsSite"] = "TechCrunch",
    ["topic"] = "Fintech",
    ["fileName"] = "techcrunch_fintech.txt",
};
var r = await lease.RunAsync(learned, inputs);
if (!r.Ok)
{
    learned = await sai.Learn.CreateAsync([], new LearnOptions
    {
        InitialCode = learned.Code,
        Evaluations = [new Evaluation(inputs, r, Passed: false)],
    });
}
```

```ruby title="Learn, run and repair"
learned = sai.learn.create([turn])
sai.control.open(machine: pc) do |lease|
  inputs = { "newsSite" => "TechCrunch", "topic" => "Fintech", "fileName" => "techcrunch_fintech.txt" }
  r = lease.run(learned, inputs)
  unless r.ok?
    learned = sai.learn.create(
      initial_code: learned.code,
      evaluations: [Sai::Evaluation.new(inputs: inputs, result: r, passed: false)]
    )
  end
end
```

## Let Sai run the loop

One call can do all four steps on a computer: `learn` with `maxIterations` runs the agent on your task (or starts from your recorded `turns`), converts its run, then runs the code several times to test Pass^k reliability, judges each run, and repairs the code after a failure, until a version passes every run or the versions run out. It answers with a [learn job](/documentation/api-reference/learn#learn-jobs) you read until it ends.

```python title="Learn a reliable function from a task"
job = sai.learn.create(
    task_template="Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
    inputs={"newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt"},
    criteria="techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
    max_iterations=3,
    rollouts=3,
)
done = sai.learn.wait(job)
print(done.test_result)   # passed 3 of 3 runs, on these inputs
print(done.code)
```

```typescript title="Learn a reliable function from a task"
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
console.log(done.testResult) // passed 3 of 3 runs, on these inputs
console.log(done.code)
```

```go title="Learn a reliable function from a task"
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
fmt.Printf("%+v\n", done.TestResult) // passed 3 of 3 runs, on these inputs
fmt.Println(done.Code)
```

```java title="Learn a reliable function from a task"
var job = sai.learn().create(List.of(), new LearnOptions()
    .taskTemplate("Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}")
    .inputs(Map.of("newsSite", "TechCrunch", "topic", "AI", "fileName", "techcrunch_headlines.txt"))
    .criteria("techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs")
    .maxIterations(3)
    .rollouts(3));
var done = sai.learn().waitFor(job);
System.out.println(done.testResult()); // passed 3 of 3 runs, on these inputs
System.out.println(done.code());
```

```csharp title="Learn a reliable function from a task"
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
Console.WriteLine(done.TestResult); // passed 3 of 3 runs, on these inputs
Console.WriteLine(done.Code);
```

```ruby title="Learn a reliable function from a task"
job = sai.learn.create(
  task_template: "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
  inputs: { "newsSite" => "TechCrunch", "topic" => "AI", "fileName" => "techcrunch_headlines.txt" },
  criteria: "techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
  max_iterations: 3,
  rollouts: 3
)
done = sai.learn.wait(job)
p done.test_result # passed 3 of 3 runs, on these inputs
puts done.code
```

The example sends no `reset`, so the runs go back to back: each starts where the last one left off, with Notepad still open and the file already saved. That is how the code starts when you rerun it, so a version that only works from a clean screen fails a run and gets repaired. When every real run starts from a known state, send a `reset` that sets it up: Simulang code, such as `reset={"code": "for (const w of await machine.getWindow(\"Notepad\")) await w.close()"}`, or a task for the agent, such as `reset={"task": "Close every Notepad window"}`. A task needs no code, but it is slower, billed like an agent run, and itself not always reliable. Each run's record says what its reset did (`reset`: `kind`, `ok`, `durationMs`), and a reset that fails stops the job (`reset_failed`).

What helps it work:

- **`criteria`** say what "done" means. The judge checks each run's return value and the screen when it ended against them.
- **`reset`** puts the computer back in its starting state before each run, as Simulang code or a task for the agent. Without it, each run starts where the last one ended, as a rerun of the code will.
- **`guidance`** passes what you know about the task to the conversion and every repair.
- **`continueWithAgent`** lets the agent finish a failed run, so the repair sees how the task is done from where the code got stuck.
- **`judgeInitialAgentRun`** stops the job before writing code when the agent's own run fails the judge.

`testResult` says how the returned code did on the inputs it ran with, not on other inputs. The runs do the task for real, so use test inputs or a test account for a task that sends or submits something.

## What the code can do

Learned code runs in a control lease, so it can do what [direct control](/documentation/concepts/direct-control) can: the screen, apps, the browser, the shell, files, and `callLLM` to answer a question about the screen (billed to your account). It cannot ask a person anything mid-run. `showMessageToUser` writes a line to the run's `logs`.

## Limits of the preview

- `learn` reads the steps, the agent's reasoning, their results and the final answer, not the screenshots.
- One experience per call: turns from one session. Several demonstrations of the same task come later.
- One exec runs for at most 300 seconds. For a longer task the code is split into step functions you call in separate execs.
- A call that only writes code never runs it. A learn job runs it on your computer, each run limited to 15 minutes by default.
- How long a call takes depends on the task: a longer run gives longer code to write and check. A learn job also depends on `maxIterations`, `rollouts`, the reset and whether the agent continues failed runs.
