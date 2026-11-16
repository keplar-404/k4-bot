# Quickstart

From sign-in to a finished task in one sitting.

Sai works on a real computer. Choose one of two before you start:

|                       | **A cloud computer from Simular**                                   | **Your own computer**                            |
| --------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| What it is            | A Windows or Linux computer Simular hosts for you                   | Your own Mac or Windows PC, the one at your desk |
| Setup                 | Nothing to install                                                  | Install the Sai Agent on it, once                |
| Good for              | Scripts, CI, coding agents, work that should not touch your desktop | Your apps, your files, your signed-in browser    |
| `kind` in `/machines` | `cloud`                                                             | `own`                                            |

The API calls are the same for both. Only the `machineId` you send differs.

### Path A: a cloud computer

Nothing to set up. A free account gets a Windows cloud computer that starts on the first task. A paid account creates one with **Create a Windows computer** or **Create a Linux computer** in the [Playground](https://platform.simular.ai/playground). Go on to step 1.

### Path B: your own Mac or Windows PC

1. On that computer, sign in at [sai.simular.ai](https://sai.simular.ai) with the same Google account you will use on this portal.
2. Open **Add computer** and choose **Your Device** (or go to **Settings → Computers → Connect your device**).
3. Download the Sai Agent for macOS or Windows, run it, sign in, and grant the permissions it asks for.

The computer then shows up in step 3 with `"kind": "own"`. This works on every plan, including free. Sai works on it only while the Sai Agent is running and the computer is awake, so a laptop that is asleep takes no tasks.

## 1. Sign in

Open [platform.simular.ai](https://platform.simular.ai) and sign in with Google.

Free accounts verify a phone number before their first key. The portal asks for it. If it was skipped, key creation returns `403` with `{ "error": "phone_verification_required" }`.

## 2. Create an API key

In the portal, create a key. The key is shown once. Copy it.

```bash title="Set your key"
export SAI_API_KEY="sapi_..."
export SAI_API_URL="https://api.simular.ai"
```

Free accounts hold one key. Paid accounts hold up to 20. See [Keys](/documentation/api-reference/keys).

## 3. Check your computers

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

```json title="200 OK · Computers"
{
  "machines": [
    {
      "machineId": "free-3fA9kQ2xYz",
      "name": "Sai cloud computer (free)",
      "kind": "cloud",
      "online": false
    }
  ]
}
```

If you connected your own computer in path B, it is listed too:

```json title="Your own computer in /machines"
{ "machineId": "Kx2mP9qRtV", "name": "Jordan's MacBook", "os": "macOS", "kind": "own" }
```

With one computer you can leave `machineId` out of every request that follows. With more than one, for example the free cloud computer and your own, pass `machineId` on each message to say which one Sai should use.

Optional: check what the account can spend.

```bash title="Check your account"
curl -s "$SAI_API_URL/v1/agents/account" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Check your account"
from sai import Sai

sai = Sai()
print(sai.account.get())
```

```typescript title="Check your account"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
console.log(await sai.account.get())
```

```go title="Check your account"
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

```java title="Check your account"
import ai.simular.sai.Sai;

Sai sai = new Sai();
System.out.println(sai.account().get());
```

```csharp title="Check your account"
using Simular.Sai;

var sai = new SaiClient();
Console.WriteLine(await sai.Account.GetAsync());
```

```ruby title="Check your account"
require "sai"

sai = Sai::Client.new
p sai.account.get
```

```json title="200 OK · Account"
{
  "userId": "3fA9kQ2xYz",
  "userState": "active_free",
  "plan": { "id": null, "title": "Free", "free": true, "unlimited": false },
  "credits": { "usd": 0.35 },
  "authType": "apiKey"
}
```

## 4. Send the first message

```bash title="Give Sai a task"
curl -s "$SAI_API_URL/v1/agents/message" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Open Notepad, type hello, save it to the desktop as hello.txt",
    "wait": false
  }'
```

```python title="Give Sai a task"
from sai import Sai

sai = Sai()
session = sai.sessions.create()
turn = session.send("Open Notepad, type hello, save it to the desktop as hello.txt")
print(turn.id, turn.queued)
```

```typescript title="Give Sai a task"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = await sai.sessions.create()
const turn = await session.send('Open Notepad, type hello, save it to the desktop as hello.txt')
console.log(turn.id, turn.queued)
```

```go title="Give Sai a task"
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
session, err := client.Sessions.Create(ctx, nil)
if err != nil {
	log.Fatal(err)
}
turn, err := session.Send(ctx, "Open Notepad, type hello, save it to the desktop as hello.txt", nil)
if err != nil {
	log.Fatal(err)
}
fmt.Println(turn.ID, turn.Queued)
```

```java title="Give Sai a task"
import ai.simular.sai.Sai;
import ai.simular.sai.Session;
import ai.simular.sai.Turn;

Sai sai = new Sai();
Session session = sai.sessions().create();
Turn turn = session.send("Open Notepad, type hello, save it to the desktop as hello.txt");
System.out.println(turn.id() + " " + turn.queued());
```

```csharp title="Give Sai a task"
using Simular.Sai;

var sai = new SaiClient();
var session = await sai.Sessions.CreateAsync();
var turn = await session.SendAsync("Open Notepad, type hello, save it to the desktop as hello.txt");
Console.WriteLine($"{turn.Id} {turn.Queued}");
```

```ruby title="Give Sai a task"
require "sai"

sai = Sai::Client.new
session = sai.sessions.create
turn = session.send("Open Notepad, type hello, save it to the desktop as hello.txt")
puts turn.id, turn.queued
```

```json title="202 Accepted · Message sent"
{ "sessionId": "cs_01HZY", "machineId": "free-3fA9kQ2xYz", "queued": false }
```

> **Note**
>
> A free account's first request can take about two minutes while its cloud computer starts. Keep polling. The session is not stuck. Your own computer starts the task at once while the Sai Agent is running.
>
> On your own Mac, ask for TextEdit or Notes instead of Notepad.

Each message continues your API conversation on that computer: Sai remembers the earlier messages, and the desktop is as the last task left it. To start fresh, call [`/new-session`](/documentation/api-reference/new-session) with `"channel": "api"` first.

## 5. Poll for events

```bash title="Poll for events"
curl -s "$SAI_API_URL/v1/agents/events?sessionId=cs_01HZY&wait=30" \
  -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Poll for events"
# `turn` is what session.send() returned in step 4; events() polls until the turn ends.
for ev in turn.events():
    print(ev.kind, ev.text)
```

```typescript title="Poll for events"
// `turn` is what session.send() returned in step 4; events() polls until the turn ends.
for await (const ev of turn.events()) {
  console.log(ev.kind, ev.text)
}
```

```go title="Poll for events"
// `turn` is what session.Send returned in step 4; Events polls until the turn ends.
for ev, err := range turn.Events(ctx, nil) {
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(ev.Kind, ev.Text)
}
```

```java title="Poll for events"
// `turn` is what session.send() returned in step 4; events() polls until the turn ends.
for (var ev : turn.events()) {
  System.out.println(ev.kind() + " " + ev.text());
}
```

```csharp title="Poll for events"
// `turn` is what session.SendAsync() returned in step 4; EventsAsync() polls until the turn ends.
await foreach (var ev in turn.EventsAsync())
{
    Console.WriteLine($"{ev.Kind} {ev.Text}");
}
```

```ruby title="Poll for events"
# `turn` is what session.send returned in step 4; events polls until the turn ends.
turn.events do |ev|
  puts "#{ev.kind} #{ev.text}"
end
```

```json title="200 OK · Events"
{
  "events": [
    { "type": "data-progress", "data": { "text": "Opening Notepad", "tool": "computer" } }
  ],
  "cursor": "1790000012345:3",
  "status": "running",
  "text": ""
}
```

Pass the returned `cursor` as `since` on the next call. Repeat while `status` is `running`.

## 6. Handle an approval

When `status` is `needs_approval`, the response carries the pending approval in a top-level `approval` field, and the events array holds the matching `data-approval-request`.

```json title="data-approval-request event"
{
  "type": "data-approval-request",
  "data": {
    "approvalId": "ap_7Qw",
    "title": "Command Approval Required",
    "description": "Sai wants to run a command.",
    "approvalType": "exec",
    "isLinkOnly": false,
    "command": "notepad.exe",
    "cwd": "C:\\Users\\sai"
  }
}
```

`isLinkOnly` is `false`, so answer over the API:

```bash title="Answer an approval"
curl -s "$SAI_API_URL/v1/agents/approve" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "approvalId": "ap_7Qw", "response": "yes" }'
```

```python title="Answer an approval"
from sai import Sai

sai = Sai()
session = sai.sessions.resume("cs_01HZY")
session.respond("ap_7Qw", "yes")
```

```typescript title="Answer an approval"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const session = sai.sessions.resume('cs_01HZY')
await session.respond('ap_7Qw', 'yes')
```

```go title="Answer an approval"
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
session := client.Sessions.Resume("cs_01HZY", nil)
if _, err := session.Respond(ctx, &sai.Approval{ID: "ap_7Qw"}, "yes", nil); err != nil {
	log.Fatal(err)
}
```

```java title="Answer an approval"
import ai.simular.sai.Sai;
import ai.simular.sai.Session;

Sai sai = new Sai();
Session session = sai.sessions().resume("cs_01HZY");
session.respond("ap_7Qw", "yes");
```

```csharp title="Answer an approval"
using Simular.Sai;

var sai = new SaiClient();
var session = sai.Sessions.Resume("cs_01HZY");
await session.RespondAsync("ap_7Qw", "yes");
```

```ruby title="Answer an approval"
require "sai"

sai = Sai::Client.new
session = sai.sessions.resume("cs_01HZY")
session.respond("ap_7Qw", "yes")
```

`"response": "task"` allows this request and similar ones for the rest of the task, so a task that inspects several files asks once. An exec approval carries no `approvalUrl`; it is answered only with `POST /approve`.

If `isLinkOnly` were `true`, you would open `approvalUrl` in a browser instead. See [Approvals](/documentation/concepts/approvals).

## 7. Read the result

Keep polling. When `status` is `idle`, `text` is Sai's answer.

```json title="200 OK · Events, task finished"
{
  "events": [{ "type": "finish", "finishReason": "stop" }],
  "cursor": "1790000098765:12",
  "status": "idle",
  "text": "Done. hello.txt is on the desktop with the text \"hello\"."
}
```

## 8. Make the next run faster and cheaper: turn the task into code

In steps 4 to 7, Sai asked a model what to do at every step. That is how it handles a task it has never seen, and it is why a run takes a while and costs model calls. A task you repeat doesn't need that every time. One `learn` call turns Sai's run into code you own: a function you can read, keep in version control and rerun on your computer with new inputs. A rerun follows the code instead of asking a model at every step, so it is faster and cheaper; a model is called only where the code reads the screen.

The code doesn't replay recorded clicks or screen positions. Each time it runs, it finds pages, windows and buttons by what they show, so a moved or resized window or a shifted layout doesn't break it. If a bigger change does, Sai can [repair the code](/documentation/concepts/learned-code).

Try it first with [Sai added to your coding agent](/documentation/coding-agents/claude-code) (Claude Code, Codex or Cursor):

```prompt title="Prompt"
Use Sai to open TechCrunch, find all AI news published today, write their headlines into Notepad and save the file as techcrunch_headlines.txt, then turn what it did into code I can rerun.
```

Or make the call yourself. Sai does the task once, writes it as Simulang code, then tests it: two runs back to back, each checked against `criteria`. Each run starts where the last one left off, with Notepad still open and the file already saved, just as your rerun will, so code that only works from a clean screen fails the test and gets repaired. If a run fails, Sai repairs the code and tries again. The examples use the first computer in your list. On your own computer, [turn on code on it](/documentation/concepts/computers#turn-on-code-on-your-own-computer) first, and on a Mac change Notepad to TextEdit in the task.

```bash title="Learn code for a task"
LEARN_ID=$(curl -s "$SAI_API_URL/v1/agents/learn" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "taskTemplate": "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
    "inputs": { "newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt" },
    "criteria": "techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
    "maxIterations": 3,
    "rollouts": 2
  }' | jq -r .learnId)

# Wait for the job to end, then save the code.
until [ "$(curl -s "$SAI_API_URL/v1/agents/learn/$LEARN_ID" \
  -H "Authorization: Bearer $SAI_API_KEY" | tee job.json | jq -r .status)" != running ]; do sleep 20; done
jq -r '.status, .testResult.status' job.json
jq -r .code job.json > main.js && cat main.js
```

```python title="Learn code for a task"
from sai import Sai

sai = Sai()
pc = sai.machines.list()[0]
job = sai.learn.create(
    task_template="Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
    inputs={"newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt"},
    criteria="techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
    max_iterations=3,
    rollouts=2,
    machine=pc,
)
done = sai.learn.wait(job)
print(done.status, done.test_result.status)
print(done.code)
```

```typescript title="Learn code for a task"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const [pc] = await sai.machines.list()
const job = await sai.learn.create([], {
  taskTemplate:
    'Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}',
  inputs: { newsSite: 'TechCrunch', topic: 'AI', fileName: 'techcrunch_headlines.txt' },
  criteria:
    'techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs',
  maxIterations: 3,
  rollouts: 2,
  machine: pc,
})
const done = await sai.learn.wait(job)
console.log(done.status, done.testResult?.status)
console.log(done.code)
```

```go title="Learn code for a task"
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
job, err := client.Learn.Create(ctx, nil, &sai.LearnOptions{
	TaskTemplate:  "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
	Inputs:        map[string]any{"newsSite": "TechCrunch", "topic": "AI", "fileName": "techcrunch_headlines.txt"},
	Criteria:      sai.CriteriaText("techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs"),
	MaxIterations: 3,
	Rollouts:      2,
	Machine:       pc.ID,
})
if err != nil {
	log.Fatal(err)
}
done, err := client.Learn.Wait(ctx, job.ID, nil)
if err != nil {
	log.Fatal(err)
}
if done.TestResult != nil {
	fmt.Println(done.Status, done.TestResult.Status)
}
fmt.Println(done.Code)
```

```java title="Learn code for a task"
import ai.simular.sai.ControlLease;
import ai.simular.sai.LearnOptions;
import ai.simular.sai.LearnResult;
import ai.simular.sai.Machine;
import ai.simular.sai.Sai;
import java.util.List;
import java.util.Map;

Sai sai = new Sai();
Machine pc = sai.machines().list().get(0);
LearnResult job = sai.learn().create(List.of(), new LearnOptions()
    .taskTemplate("Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}")
    .inputs(Map.of("newsSite", "TechCrunch", "topic", "AI", "fileName", "techcrunch_headlines.txt"))
    .criteria("techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs")
    .maxIterations(3)
    .rollouts(2)
    .machine(pc));
LearnResult done = sai.learn().waitFor(job);
System.out.println(done.status() + " " + (done.testResult() != null ? done.testResult().status() : null));
System.out.println(done.code());
```

```csharp title="Learn code for a task"
using Simular.Sai;

var sai = new SaiClient();
var pc = (await sai.Machines.ListAsync())[0];
var job = await sai.Learn.CreateAsync([], new LearnOptions
{
    TaskTemplate =
        "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
    Inputs = new Dictionary<string, object> { ["newsSite"] = "TechCrunch", ["topic"] = "AI", ["fileName"] = "techcrunch_headlines.txt" },
    Criteria =
        "techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
    MaxIterations = 3,
    Rollouts = 2,
    Machine = pc,
});
var done = await sai.Learn.WaitAsync(job);
Console.WriteLine($"{done.Status} {done.TestResult?.Status}");
Console.WriteLine(done.Code);
```

```ruby title="Learn code for a task"
require "sai"

sai = Sai::Client.new
pc = sai.machines.list.first
job = sai.learn.create(
  task_template: "Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}",
  inputs: { "newsSite" => "TechCrunch", "topic" => "AI", "fileName" => "techcrunch_headlines.txt" },
  criteria: "techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs",
  max_iterations: 3,
  rollouts: 2,
  machine: pc
)
done = sai.learn.wait(job)
puts done.status, done.test_result.status
puts done.code
```

The job keeps the computer busy until it ends; how long depends on the task. Then it prints `succeeded passed` (both runs passed the check) and the code, which looks like this (shortened):

```javascript title="The learned code"
async function main(
  params = { newsSite: 'TechCrunch', topic: 'AI', fileName: 'techcrunch_headlines.txt' },
) {
  try {
    console.log('Opening the ' + params.topic + ' section of ' + params.newsSite + '...')
    var sectionUrl = callLLM({
      prompt: `What is the full URL of the "${params.topic}" news section on "${params.newsSite}"? Reply with only the URL.`,
    }).trim()
    var page = await machine.browser.newtab(sectionUrl)
    await page.wait({ waitTime: 3 })
    if (
      !(await machine.stateSatisfies({
        condition: `the browser shows ${params.newsSite} listing ${params.topic} news articles`,
      }))
    ) {
      throw new Error(
        `precondition_failed: the ${params.newsSite} ${params.topic} section did not load`,
      )
    }

    var snap = await page.snapshot()
    var raw = callLLM({
      prompt: `List the exact headline of every ${params.topic} article published today. Return only a JSON array of strings.`,
      context: { text: snap.snapshot.outline(), imageBase64: await page.screenshot() },
    })
    var headlines = JSON.parse(raw.match(/\[[\s\S]*\]/)[0])
    console.log('Found ' + headlines.length + ' headlines published today')

    await machine.copyToClipboard({ text: headlines.join('\n'), intent: 'copy the headlines' })
    var notepad = await machine.launch('notepad')
    // ... paste into a new tab, then Save As with params.fileName (if the dialog fails,
    // write the file directly and open it in Notepad)

    return { file: params.fileName, count: headlines.length, headlines: headlines }
  } catch (e) {
    console.log('Task failed: ' + (e && e.message ? e.message : e))
    throw e
  }
}
```

Now rerun it yourself. This is the fast, cheap run: the code decides the steps, not the agent.

```bash title="Run the learned code"
MACHINE_ID=$(curl -s "$SAI_API_URL/v1/agents/machines" \
  -H "Authorization: Bearer $SAI_API_KEY" | jq -r '.machines[0].machineId')
curl -s -X POST "$SAI_API_URL/v1/machines/$MACHINE_ID/control" -H "Authorization: Bearer $SAI_API_KEY"
jq -n --rawfile code main.js '{ code: ($code + "\nawait main()"), timeoutMs: 300000 }' |
  curl -s "$SAI_API_URL/v1/machines/$MACHINE_ID/control/exec" \
    -H "Authorization: Bearer $SAI_API_KEY" -H "Content-Type: application/json" -d @- | jq .result
curl -s -X DELETE "$SAI_API_URL/v1/machines/$MACHINE_ID/control" -H "Authorization: Bearer $SAI_API_KEY"
```

```python title="Run the learned code"
# Continue from the code above.
with sai.control.open(pc) as lease:
    print(lease.run(done).result)
```

```typescript title="Run the learned code"
// Continue from the code above.
const lease = await sai.control.open({ machine: pc })
try {
  console.log((await lease.run(done)).result)
} finally {
  await lease.close()
}
```

```go title="Run the learned code"
// Continue from the code above.
lease, err := client.Control.Open(ctx, pc.ID)
if err != nil {
	log.Fatal(err)
}
defer lease.Close(ctx)
r, err := lease.Run(ctx, done, nil, nil)
if err != nil {
	log.Fatal(err)
}
fmt.Println(r.Result)
```

```java title="Run the learned code"
// Continue from the code above.
try (ControlLease lease = sai.control().open(pc)) {
  System.out.println(lease.run(done).result());
}
```

```csharp title="Run the learned code"
// Continue from the code above.
await using var lease = await sai.Control.OpenAsync(pc);
Console.WriteLine((await lease.RunAsync(done)).Result);
```

```ruby title="Run the learned code"
# Continue from the code above.
sai.control.open(machine: pc) do |lease|
  p lease.run(done).result
end
```

It saves today's AI headlines from TechCrunch to techcrunch_headlines.txt and returns them. Pass other inputs to run the same code on another topic, for example `await main({ newsSite: "TechCrunch", topic: "Fintech", fileName: "techcrunch_fintech.txt" })`.

To read the job while it runs, see each run and its judgement, or choose how many versions and runs to allow, see [Learn jobs](/documentation/api-reference/learn#learn-jobs).

## Or use an SDK

```bash title="Install"
pip install sai-sdk               # Python
npm install @simular-ai/sai-sdk   # TypeScript
```

```python title="Run a task"
from sai import Sai

result = Sai().sessions.create().run("Open Notepad, type hello, save it to the desktop as hello.txt")
print(result.text)
```

```typescript title="Run a task"
import { Sai } from '@simular-ai/sai-sdk'

const session = await new Sai().sessions.create()
const result = await session.run('Open Notepad, type hello, save it to the desktop as hello.txt')
console.log(result.text)
```

```go title="Run a task"
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
session, err := client.Sessions.Create(ctx, nil)
if err != nil {
	log.Fatal(err)
}
result, err := session.Run(ctx, "Open Notepad, type hello, save it to the desktop as hello.txt", nil)
if err != nil {
	log.Fatal(err)
}
fmt.Println(result.Text)
```

```java title="Run a task"
import ai.simular.sai.Sai;
import ai.simular.sai.Session;
import ai.simular.sai.TurnResult;

Session session = new Sai().sessions().create();
TurnResult result = session.run("Open Notepad, type hello, save it to the desktop as hello.txt");
System.out.println(result.text());
```

```csharp title="Run a task"
using Simular.Sai;

var session = await new SaiClient().Sessions.CreateAsync();
var result = await session.RunAsync("Open Notepad, type hello, save it to the desktop as hello.txt");
Console.WriteLine(result.Text);
```

```ruby title="Run a task"
require "sai"

result = Sai::Client.new.sessions.create.run("Open Notepad, type hello, save it to the desktop as hello.txt")
puts result.text
```

The SDK does the polling and maps errors to exceptions; an approval comes back on the result. See the [Python SDK](/documentation/sdks/python) and the [TypeScript SDK](/documentation/sdks/typescript).

## Or add Sai to your coding agent

```bash title="Add to Claude Code"
claude mcp add sai -e SAI_API_KEY=sapi_... -- npx -y @simular-ai/sai-mcp
```

Then ask Claude Code to use Sai to open Notepad and save hello.txt on the desktop. The same server works in [Codex](/documentation/coding-agents/codex) and [Cursor](/documentation/coding-agents/cursor).
