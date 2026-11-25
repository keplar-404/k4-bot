# TypeScript

The TypeScript SDK wraps the API on these pages, method for method like the [Python SDK](/documentation/sdks/python):

- **Sessions**: give Sai a task on a computer, and get the answer back. Sai decides every click.
- **Direct control**: your code drives a computer directly with Simulang. No agent decides the steps; only the model calls your code makes are billed.

> **Note**
>
> Current version is `0.4.0`. The API may still change before `1.0.0`.

## Install

```bash title="Install"
npm install @simular-ai/sai-sdk
export SAI_API_KEY="sapi_..."
```

Node.js 18.17 or later; it uses the built-in `fetch`. No runtime dependencies. ESM only, so the examples use top-level `await`. Create the key in the [portal](https://platform.simular.ai) (see [Quickstart](/documentation/quickstart)).

## Give Sai a task

```typescript title="Give Sai a task"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const [pc] = await sai.machines.list()

const session = await sai.sessions.create({ machine: pc })
const result = await session.run('Open Notepad, type hello, save it to the desktop as hello.txt')

console.log(result.status) // idle, needs_approval or error
console.log(result.text) // Sai's answer
console.log(result.usage) // tokens and cost of this task
```

- `machine` can be left out when the account has one computer.
- More `session.run(...)` calls continue the same conversation. `sai.sessions.create()` starts a new one with no memory of the old. See [Sessions](/documentation/concepts/sessions).
- `run()` sends the task and waits. On a free account the first task of the day waits about two minutes while the computer starts.

## Watch it work

`send()` resolves at once with a turn. Iterate its events, then read the result:

```typescript title="Watch the events"
const turn = await session.send("Find last month's invoices in Downloads and total them")
for await (const ev of turn.events()) {
  if (ev.kind === 'step') console.log('  ', ev.text)
  else if (ev.kind === 'approval') await turn.respond(ev.approval!, 'yes')
}
const result = await turn.wait()
```

| `ev.kind`    | What it is                                                         |
| ------------ | ------------------------------------------------------------------ |
| `step`       | A progress line: what Sai is doing                                 |
| `message`    | Sai's text                                                         |
| `approval`   | Sai is waiting for permission. `ev.approval` holds it              |
| `tool_error` | A step failed. Sai usually recovers                                |
| `error`      | The turn failed. `ev.code` is set when the account ran out (below) |
| `finished`   | The turn is complete                                               |

`turn.events({ raw: true })` also yields reasoning, tool-call and framing frames as `other`, with the wire event in `ev.raw`. See [Events](/documentation/api-reference/events).

## Approvals

Sai asks before risky actions (see [Approvals](/documentation/concepts/approvals)). Without a handler, `run()` and `wait()` resolve with `status === 'needs_approval'` and the request in `result.approval`. To answer as it comes, pass `onApproval`:

```typescript title="Approval handler"
const result = await session.run('Clean up the temp folder', {
  onApproval: (approval) => {
    if (approval.isLinkOnly) {
      console.log('Approve in a browser:', approval.url)
      return null // a person answers it; keep waiting
    }
    if (approval.type === 'choice') {
      return ['yes', approval.questions.map((q: any) => [q.options[0].value])]
    }
    return 'yes'
  },
})
```

The handler returns `'yes'`, `'no'`, `'task'` (allow the rest of this task), a `[response, selections]` pair for a choice, or `null` to leave the approval to someone else. A link-only approval cannot be answered over the API: `respond()` throws `LinkOnlyApprovalError` with `approvalUrl`.

For an unattended run with nobody to answer, pass `autonomous: true`. The turn runs as if `'task'` had been answered up front, and the grant ends with the turn. Link-only approvals still stop it. See [Unattended runs](/documentation/api-reference/message#unattended-runs).

```typescript title="Unattended run"
await session.run("Export last month's invoices to CSV", { autonomous: true })
```

## Files, models, stopping

```typescript title="Files, models, stopping"
const report = await sai.files.upload('report.pdf') // or { data: bytes, name: 'report.pdf' }
await session.run('Summarise the attached report', { attachments: [report] })

const allowed = (await sai.models.list()).filter((m) => m.allowed).map((m) => m.id)
await session.run('...', { model: 'anthropic/claude-opus-5-5' }) // sticks to the session

const turn = await session.send('...')
await turn.abort()
```

A message sent while a turn is running steers that turn; `turn.queued` is then `true`.

## Typed output (advanced)

Pass `outputSchema` and the turn's record comes back in `result.record`, with `output` matching the schema. See [Structured output](/documentation/concepts/structured-output) for every option.

```typescript title="Typed output"
const result = await session.run(
  'Open https://news.ycombinator.com and read the title of the top story.',
  {
    outputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
  },
)
if (result.ok) console.log((result.record?.output as { title: string }).title)
else console.log(result.record?.reasonCode) // e.g. output_invalid
```

`send()` and `run()` also take `inputs`, `successCriteria` (a string, or a list of checks), `idempotencyKey` and `recordTrajectory`, and `thinkingLevel` (`'off'`, `'low'`, `'medium'`, `'high'` or `'xhigh'`). Every turn has an id, `turn.id`; read it later with `sai.turns`:

```typescript title="Read a turn later"
const turn = await session.send('...', { recordTrajectory: true })
const record = await sai.turns.wait(turn) // until succeeded, failed or needs_input
for (const step of await sai.turns.trajectory(turn)) {
  console.log(step.index, step.title)
}
```

## Learn code from turns (research preview)

`sai.learn` turns recorded turns into Simulang code you run with a control lease, and repairs it. `sai.judge` checks recorded turns against criteria you choose afterwards. See [Learned code](/documentation/concepts/learned-code).

```typescript title="Learn and repair code"
const turn = await session.send('Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}', {
  inputs: { newsSite: 'TechCrunch', topic: 'AI', fileName: 'techcrunch_headlines.txt' },
  recordTrajectory: true,
})
await sai.turns.wait(turn)

const learned = await sai.learn.create([turn]) // waits for the code; longer for a longer task
const lease = await sai.control.open({ machine: pc })
const r = await lease.run(learned, { newsSite: 'TechCrunch', topic: 'Fintech', fileName: 'techcrunch_fintech.txt' }) // inputs over the defaults
console.log(r.result)
await lease.close()

const fixed = await sai.learn.create([], {
  initialCode: learned.code,
  evaluations: [{ inputs: { newsSite: 'TechCrunch', topic: 'Fintech', fileName: 'techcrunch_fintech.txt' }, result: r, passed: false }],
})
const judgement = await sai.judge.create(
  [turn],
  [{ id: 'file', check: 'The agent saved the headlines to the file' }],
)
```

`learned.status` is `failed` when the code still has `learned.validation.errors`.

With `maxIterations`, `learn` also runs the code on a computer, judges each run and repairs the code until it passes, starting from your `turns` or, without them, from an agent run of `taskTemplate`. The call answers at once with a [learn job](/documentation/api-reference/learn#learn-jobs); `wait` reads it until it ends.

```typescript title="Run, judge and repair on a computer"
const job = await sai.learn.create([], {
  taskTemplate: 'Open {{newsSite}}, find all {{topic}} news published today, write their headlines into Notepad, one per line, and save the file as {{fileName}}',
  inputs: { newsSite: 'TechCrunch', topic: 'AI', fileName: 'techcrunch_headlines.txt' },
  machine: pc,
  criteria: 'techcrunch_headlines.txt is saved and holds only the headlines of the AI articles TechCrunch published today, one per line, with no text left from earlier runs',
  maxIterations: 3, // up to 3 code versions; 0 (the default) only writes the code
  rollouts: 3, // each version must pass 3 runs in a row
  continueWithAgent: true, // after a failed run, the agent finishes the task and the repair learns from it
})
const done = await sai.learn.wait(job) // can take an hour; timeoutMs to stop waiting
console.log(done.status, done.stopReason, done.testResult)
console.log(done.code) // the latest version
for (const it of done.iterations) console.log(it.index, it.changes, it.rollouts.map((r) => r.verdict))

const run = await sai.learn.rollout(job, 1, 1) // what one run returned and logged, and its judgement
await sai.learn.cancel(job) // stops at once and keeps the last complete results
```

`template` and `feedback` are still accepted as the old names of `taskTemplate` and `guidance`.

## Drive a computer yourself

A control lease holds one computer and runs [Simulang](/documentation/concepts/direct-control) blocks on it. While it is open, Sai's own tasks on that computer wait, so always close it.

```typescript title="Drive a computer"
import { writeFile } from 'node:fs/promises'

const lease = await sai.control.open({ machine: pc })
try {
  console.log((await lease.shell('hostname')).stdout)

  await lease.writeFile('C:\\data\\note.txt', 'hello')
  console.log(await lease.readFile('C:\\data\\note.txt'))

  const r = await lease.exec(`
    var page = await machine.browser.newtab('https://example.com')
    var snap = await page.snapshot()
    snap.title
  `)
  console.log(r.result) // Example Domain
  await writeFile(`page.${r.screenshotMimeType!.split('/')[1]}`, r.screenshot!) // jpeg or png
} finally {
  await lease.close()
}
```

- With TypeScript 5.2 or later and a runtime with explicit resource management, `await using lease = await sai.control.open(...)` closes it for you.
- `exec()` resolves with an `ExecResult` with `result`, `logs`, `error`, `screenshot`, `screenshotMimeType` and `durationMs`. A block that throws still resolves: check `r.error.kind` (`exception`, `timeout`, `interrupted`).
- Use `var`, not `let` or `const`, for values the next block needs.
- `lease.screenshot()` grabs the whole screen. It needs the computer's screen-capture service; where that is off it throws `BlockError`, and a page or app snapshot is the way to get an image.
- `lease.interrupt()` stops a running block while `exec()` is waiting.

Direct control is a research preview, open to every account; the model calls the code makes are billed as usual. See [Control](/documentation/api-reference/control) for limits and errors.

## Other calls

```typescript title="Other calls"
await sai.account.get() // plan and spendable credit
await sai.models.list() // models, with `allowed` for this plan
await sai.machines.live(pc) // a link to the screen for a person, and a stream for your viewer; see Live view
await sai.machines.revokeLive(pc) // every liveUrl stops working and its screen sessions end; resolves with how many
```

```typescript title="Who the key is, and its sessions"
await sai.auth.check() // the user, and the Tenant and Organisation for a Tenant token
await sai.sessions.list({ machine: pc }) // your sessions on the computer, any channel, most recent first
```

### Hand the screen to a person

When Sai needs a person at the screen (a sign-in, a captcha), `machines.live` resolves with a `LiveView` whose `liveUrl` is a page anyone with the link can open without a Simular account. They can use the mouse and keyboard. The page pauses its own input while a Sai turn runs; the pause is not enforced. Send a message once they are done, and revoke the link.

```typescript title="Hand the screen to a person"
const view = await sai.machines.live(pc)
console.log('Sign in here, then tell me:', view.liveUrl) // valid until view.expiresAt (ms)
// ... once they are done
await session.run('I signed in. Carry on.')
await sai.machines.revokeLive(pc) // resolves with the number of links revoked
```

- `liveUrl` and `expiresAt` (Unix time in milliseconds) are `null` where the server does not offer the page.
- `websocketUrl` is the same screen as a Guacamole tunnel for a viewer of your own. It takes input too.
- `machines.revokeLive(machine)` revokes every `liveUrl` handed out for the computer, ends the screen sessions they opened, and resolves with the number revoked. See [When Sai needs a person](/documentation/concepts/approvals#when-sai-needs-a-person).

## Run Sai for your customers

With an [Organisation](/documentation/organisations), each customer is a Tenant. Your backend manages Tenants with an [Organisation Key](/documentation/organisations/keys), and acts as one Tenant through a [Tenant token](/documentation/organisations/tenant-tokens).

```typescript title="Tenants"
import { Sai } from '@simular-ai/sai-sdk'

const org = new Sai({ apiKey: process.env.SAI_ORG_KEY, orgId: 'org_3f9a1c0b7e2d4a6f8c10' })

const tenant = await org.tenants.create('Riverside Clinic', { externalId: 'clinic-4821' })
const enrollment = await org.tenants.createEnrollment(tenant) // hand enrollment.token to your installer
console.log(await org.tenantMachines.list(tenant))

const clinic = await org.tenants.client(tenant) // acts as the Tenant
const session = await clinic.sessions.create()
await session.run("Open the calendar and read today's appointments")
```

- `org.tenants.client(tenant)` exchanges the Organisation Key for a one-hour Tenant token, and exchanges again when it has less than five minutes left. `org.tenants.token(tenant)` is the exchange alone: pass `token.token` as `new Sai({ apiKey })`.
- `orgId` is needed only for the exchange. It defaults to `SAI_ORG_ID`; `token()` and `client()` also take `{ orgId }`.
- `org.tenants.list({ status, externalId, limit, cursor })` resolves with one page: `page.tenants` and `page.nextCursor`. `externalId` finds your customer's Tenant without storing its id.
- `org.tenants.update(tenant, { name, metadata, status })`. `status: 'disabled'` stops the Tenant, `'active'` brings it back. `org.tenants.delete(tenant)` disables it and revokes every machine.
- `org.tenantMachines.get(tenant, machineId)` and `org.tenantMachines.revoke(tenant, machine)`.

A Tenant can also have [cloud machines](/documentation/organisations/cloud-machines) that Sai hosts:

```typescript title="Cloud machines"
import { randomUUID } from 'node:crypto'
import { Sai } from '@simular-ai/sai-sdk'

const org = new Sai({ apiKey: process.env.SAI_ORG_KEY, orgId: 'org_3f9a1c0b7e2d4a6f8c10' })

const machine = await org.tenantMachines.create('Xk2p9QzR4tLm8vNa3bCd', {
  os: 'windows',
  name: 'Riverside intake',
  requestId: randomUUID(),
  wait: true,
})
const clinic = await org.tenants.client('Xk2p9QzR4tLm8vNa3bCd')
const session = await clinic.sessions.create({ machine: machine.id })
await session.run('Open Notepad and type hello')
await org.tenantMachines.delete('Xk2p9QzR4tLm8vNa3bCd', machine)
```

- `org.tenantMachines.create(tenant, { os, name, requestId, wait, timeoutMs })`. `os` is `'windows'` or `'linux'`. Pass the same `requestId` when you retry a create. With `wait: true` it gets the machine every 5 seconds until its `state` is `ready`. A `failed` or `deleting` machine throws `SaiError` with the machine in `e.body`. No `ready` within `timeoutMs` throws `TimeoutError`.
- `org.tenantMachines.list(tenant)` and `.get(tenant, machineId)` return both kinds. Each machine has `kind`, `state`, `machineClass` (cloud only) and `createdAt`.
- `org.tenantMachines.delete(tenant, machine)` resolves with `'deleting'` for a cloud machine and `'revoked'` for an enrolled one.
- `org.tenants.update(tenant, { cloudMachineLimit, residentialProxy })`. `cloudMachineLimit: null` removes the limit. `residentialProxy` has no effect yet.
- A refused create throws the usual `SaiError` subclass. Its details are in `e.body`: `limit` and `used`, `scope` and `resetsAt`, or `errorId`.

See [Tenants](/documentation/organisations/tenants) for every field and error.

### What your Tenants spent

```typescript title="Usage"
import { Sai } from '@simular-ai/sai-sdk'

const org = new Sai({ apiKey: process.env.SAI_ORG_KEY, orgId: 'org_3f9a1c0b7e2d4a6f8c10' })
const usage = await org.usage.get({ granularity: 'month', from: '2026-10', to: '2026-10' })
for (const t of Object.values(usage.totals.byTenant)) console.log(t.name, t.costCents)

const page = await org.usage.sessions('Xk2p9QzR4tLm8vNa3bCd', { from: '2026-10-01', to: '2026-10-31' })
for (const s of page.sessions) console.log(s.sessionId, s.costUsd)
```

- `org.usage.get({ granularity, from, to })` is what the Organisation is charged, in total and per Tenant, per `hour`, `day` or `month`. See [Organisation usage](/documentation/organisations/orgs#organisation-usage).
- `org.usage.sessions(tenant, { from, to, limit, cursor })` is one page of what each of the Tenant's sessions spent on AI calls. Keep passing `page.nextCursor` as `cursor` until it is null: a page can be empty and not be the last. With `{ sessionIds: [...] }` (1 to 50) instead of the range, it is those sessions' spend right now, each with `settled` (`true` once its latest task has ended and every charge for it has come in), and the page's `asOf`; `costUsd` and `modelCalls` are null when a session can't be read in full right now. See [Session spend](/documentation/organisations/session-spend).
- Both take `{ orgId }`, defaulting to the client's `orgId` (`SAI_ORG_ID`).

## Errors

Every non-2xx response throws a `SaiError` subclass carrying `status`, `code`, `message` and `retryAfter`:

| Error                     | When                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `AuthenticationError`     | `401`: the key is missing, unknown or revoked                      |
| `BadRequestError`         | `400`: for example several computers and no `machine`              |
| `PermissionDeniedError`   | `403`: plan or ownership, such as `model_not_allowed_for_plan`     |
| `ConflictError`           | `409`: for example `machine_busy`, or an approval already answered |
| `LinkOnlyApprovalError`   | The approval must be answered in a browser: `e.approvalUrl`        |
| `GoneError`               | `410`: the control lease ended (`e.body.reason`). Open a new one   |
| `SpendCapReachedError`    | `403`: the key reached its monthly spend limit. `e.resetsAt`       |
| `RateLimitError`          | `429`: a rate limit, or the free plan's daily computer time        |
| `ServiceUnavailableError` | `503`: the computer did not come online. Honor `retryAfter`        |
| `BlockError`              | A control helper's block failed on the computer                    |

A task that ran out of credit is not an error. It ends with `result.status === 'error'` and `result.errorCode` set to `insufficient_credits` or `free_computer_time_exhausted`. Stop retrying for today. See [Billing and limits](/documentation/concepts/billing-and-limits).

## Configuration

| Option      | Environment   | Default                  |
| ----------- | ------------- | ------------------------ |
| `apiKey`    | `SAI_API_KEY` | required                 |
| `baseUrl`   | `SAI_API_URL` | `https://api.simular.ai` |
| `timeoutMs` |               | 60 000 per request       |
| `fetch`     |               | the global `fetch`       |
| `orgId`     | `SAI_ORG_ID`  | for `tenants.token()` and `usage` |
