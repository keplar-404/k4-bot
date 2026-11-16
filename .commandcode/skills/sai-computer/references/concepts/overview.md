# Sai API

What the Sai API is, when to use it, and how a request flows through it.

The Sai API lets your code or your coding agent hand a task to Sai, a computer-use agent that works on a real Windows, macOS or Linux computer. You send a message, Sai works on the computer, and you read the result.

That computer can be one Simular hosts for you in the cloud, or your own Mac or Windows PC with the Sai Agent installed. The [Quickstart](/documentation/quickstart) starts with that choice.

Sai uses apps and websites the way a person does, by seeing the screen, clicking and typing, so it gets work done where there is no API: web apps behind a login, admin consoles, desktop software, forms with no import. It is #1 on [OSWorld 2.0](https://www.simular.ai/articles/sai-tops-osworld-2-0) (73%). Run a workflow once and Sai can save it as code: later runs replay that code and ask the model only where the screen matters, so they are faster and cheaper, and the agent takes over when the UI changes.

## When to use Sai

| Use Sai when                                                                                                                                | Write code when                           |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| There is no API, or the API doesn't cover the task (vendor portals, admin consoles, legacy web apps)                                        | A documented API or SDK does the job      |
| The task needs a real browser session with someone's accounts; sign-ins go to the human as an [approval](/documentation/concepts/approvals) | The data is already local or in your repo |
| The work happens in a desktop app, on Windows, macOS or Linux                                                                               | You need exact, byte-for-byte output      |
| It is a one-off, and a script would cost more to write and keep working than the task                                                       |                                           |
| You need to see what a real user sees: testing a sign-up flow, reproducing a bug report                                                     |                                           |
| It is a workflow you will repeat: run it once, then replay it as code (below)                                                               |                                           |

## Run once, replay as code

Most computer-use agents re-plan every step on every run. Sai can turn a workflow it has done into a reusable skill: the steps that stay the same become code, and the model is asked only about what depends on the screen.

1. Run the task once.
2. In the same conversation, ask Sai to `Save this as a replayable skill named invoice_export, with vendor and month as parameters.`
3. Next time, send `Run invoice_export for vendor Acme, month March.` Sai replays the code. When a step breaks because the UI changed, the agent takes over from there.

The research behind it: in [Neuro-Symbolic Computer Use](https://arxiv.org/abs/2609.36927) (Sep 2026), learned policies cut per-run cost 15–217× and latency 3.4–5.1×, and raised Pass^3 (success on all three of three runs) by 3.6–15.8 points over the base agent on OSWorld-Verified and ScienceBoard.

## Example tasks

- `Open our staging site in Chrome, sign up with the test Gmail account, click the verification email, and tell me where the flow breaks.`
- `Log in to the vendor portal (it has no API) and list last month's invoices with their totals.`
- `Enter each row of the uploaded CSV into the supplier form at https://example.com/suppliers/new, which has no import, and report the rows that failed validation.`
- `Follow the steps in this bug report in Chrome on Windows and describe exactly what happens at each step.`
- `In the admin console, export the user list and tell me which accounts haven't signed in for 90 days.`

## Base URL

```text title="Base URL"
https://api.simular.ai/v1/agents
```

The portal, where you sign in and create API keys, is [platform.simular.ai](https://platform.simular.ai).

## How a request flows

1. You `POST /message` with a task. With `wait: false` the API answers at once with a `sessionId`.
2. Sai works on the computer. You `GET /events` to read progress, text and approval requests.
3. When Sai needs permission, an event of type `data-approval-request` arrives. You answer it with `POST /approve`, or you open its `approvalUrl` in a browser when a human has to act.
4. When `status` is `idle`, `text` holds the result. For typed output your code can use, add [`options`](/documentation/concepts/structured-output) to the message and read the turn with `GET /v1/agents/turns/{turnId}`.

Every call carries `Authorization: Bearer sapi_...`. See [Authentication](/documentation/api-reference/authentication).

## Two ways to use it

- **HTTP.** Any language. Start with the [Quickstart](/documentation/quickstart) and the [examples](/documentation/examples/curl).
- **A coding agent.** Claude Code, Codex and Cursor call Sai through the `@simular-ai/sai-mcp` server. One command installs it. See [Claude Code](/documentation/coding-agents/claude-code).
- **Direct control** (research preview). Skip the task and drive the computer yourself: run Simulang code on it and get screenshots back. See [Direct control](/documentation/concepts/direct-control).

## What you get

- A computer: a cloud computer Simular hosts (free accounts get one pooled Windows computer; paid accounts create Windows or Linux ones), your own Mac or Windows PC with the Sai Agent, or both. See [Computers](/documentation/concepts/computers).
- One conversation per API key and computer on the API channel. Follow-up messages continue it. See [Sessions](/documentation/concepts/sessions).
- No model keys to bring. The model and the computer are included in your Sai plan. See [Billing and limits](/documentation/concepts/billing-and-limits).

## Streaming or polling

`POST /message` with `wait: true` (the default) streams events over Server-Sent Events. Use it from a browser or a long-lived process. Coding agents and short scripts should send `wait: false` and poll `/events`. Both paths carry the same [event vocabulary](/documentation/api-reference/events).

Looking for the `simulang` CLI or the legacy Simular Pro curl trigger? Those are documented on [docs.simular.ai](https://docs.simular.ai).
