# TypeScript

The loop with the TypeScript SDK.

These examples use the [TypeScript SDK](/documentation/sdks/typescript). For the same loop over plain HTTP with no dependencies, see [Node](/documentation/examples/node).

## Polling

```bash title="Install"
npm install @simular-ai/sai-sdk
export SAI_API_KEY="sapi_..."
```

```typescript title="sai.mts"
import { Sai, type Approval, type ApprovalAnswer } from '@simular-ai/sai-sdk'

const sai = new Sai()

function decide(approval: Approval): ApprovalAnswer {
  if (approval.isLinkOnly) {
    console.log('Open in a browser:', approval.url)
    return null // a person answers it; keep waiting
  }
  if (approval.type === 'choice') {
    return ['yes', approval.questions.map((q: any) => [q.options[0].value])]
  }
  console.log('Approving:', approval.title)
  return 'yes'
}

const session = await sai.sessions.create()
const turn = await session.send('Open Notepad, type hello, save it to the desktop as hello.txt')
for await (const ev of turn.events()) {
  if (ev.kind === 'step') console.log('  ', ev.text)
}
const result = await turn.wait({ onApproval: decide })

if (result.status === 'error') throw new Error(result.errorCode ?? result.text ?? 'task failed')
console.log(result.text)
```

```bash title="Run it"
node sai.mts
```

- `events()` polls `GET /v1/agents/events` with the cursor and ends when the turn stops: done, failed, or waiting on an approval. `wait()` answers approvals through `decide` and keeps waiting.
- A `429` from a rate limit throws `RateLimitError` with `retryAfter` in seconds.
- Node.js 23.6 or later runs `.mts` files directly. On older versions, name the file `sai.mjs` and drop the type annotations.

## Uploading a file

```typescript title="Upload a file"
const report = await sai.files.upload('report.pdf') // at most 25 MB
const summary = await session.run('Summarise the attached PDF', { attachments: [report] })
console.log(summary.text)
```

## Getting typed output

```typescript title="Get typed output"
const typed = await session.run(
  'Open https://news.ycombinator.com and read the title of the top story.',
  {
    outputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
  },
)
if (typed.ok) console.log((typed.record?.output as { title: string }).title)
else console.log(typed.record?.reasonCode)
```

## Stopping a task

```typescript title="Stop the task"
const long = await session.send('Organise every file in Downloads by type')
setTimeout(() => void long.abort(), 30_000)
console.log((await long.wait()).status)
```
