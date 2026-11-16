---
name: sai-computer
description: Simular's Sai API, a hosted computer-use agent that does a task on a real Windows, macOS or Linux computer and returns the result, with approvals, a live screen, typed output and "learn once, replay as code". Use this skill whenever the user mentions Sai, Simular, api.simular.ai, sai-sdk or sai-mcp. Also use it when they want the eve agent to hand off computer-use work (websites without an API, logged-in browser sessions, desktop apps, repeated workflows, watching the agent's screen live) instead of driving an E2B desktop step by step, even if they don't name Sai.
---

# Sai computer (Simular Sai API)

## What it is and why it matters here

Sai is a computer-use agent that Simular hosts. Your code sends one task message. Sai does all the clicking and typing on a real computer and gives back the result.

For this project, the eve agent can hand off a whole computer task with a single tool call. It doesn't need to rebuild E2B desktop tools or run the screenshot loop itself, so it spends far fewer tokens. Sai's model and computer come with the Sai plan, so no model keys are needed.

## The docs in this folder

Every `.md` file under `references/` is the user's own copy of the official docs, kept word for word. Never edit, shorten or rewrite those files; only this SKILL.md is ours to change. Read the page you need before you write code, and copy field names from it rather than guessing. Some file names have the user's spelling (`abrot.md`, `controll.md`, `direct-controll.md`); keep them as they are.

Links inside the docs (`/documentation/...`) are relative to `https://platform.simular.ai`. Pages not saved here, such as the Python SDK and live view, have to be looked up there.

### `references/concepts/`: what things are and how they behave. Read these first.

| File | Read it for |
| --- | --- |
| `overview.md` | What Sai is, when to use it versus writing code, base URL, how a request flows |
| `quickstart.md` | The whole flow end to end: key, machines, message, poll, approve, result, `learn`, SDK, MCP |
| `computer.md` | The two kinds of machine (`cloud` / `own`), the free pooled computer, how `machineId` is picked, waking |
| `sessions.md` | One conversation per API key per computer, `new-session`, one task at a time (steer / `queued`), the `running`/`needs_approval`/`idle`/`error` statuses, what a caller can see |
| `approvals.md` | The two classes of approval (`isLinkOnly`), finding the pending one, expiry, when a person must act |
| `structured-output.md` | `options` on a message: output schema, success criteria, templates, idempotency, trajectory, usage |
| `learned-code.md` | Turning a run into Simulang code, running it without the agent, repairing it |
| `direct-controll.md` | Driving a computer yourself with Simulang (not a session), and its safety notes |
| `billing-and-limit.md` | Credits, free versus paid, spend limits, models, rate limits, key limits, storage |

### `references/api-reference/`: one endpoint per file, with request, response, errors and gotchas

| File | Endpoint |
| --- | --- |
| `authentication.md` | Bearer keys, Organisation Keys and Tenant tokens, who can use a key |
| `keys.md` | `/v1/account/keys`: create, list, update, revoke |
| `accounts.md` | `GET /v1/agents/account`: plan and balance |
| `machines.md` | `GET /v1/agents/machines`, creating a computer, live screen (`liveUrl`, `websocketUrl`), revoking live links |
| `send-messages.md` | `POST /v1/agents/message`: `wait`, `options`, unattended runs |
| `events.md` | `GET /v1/agents/events`: the polling loop, the full event list, token usage |
| `approve.md` | `POST /v1/agents/approve` |
| `abrot.md` | `POST /v1/agents/abort`: stop a task |
| `new-sessions.md` | `POST /v1/agents/new-session`: start fresh |
| `turn.md` | `GET /v1/agents/turns/{turnId}`, trajectory, screenshot |
| `uploads.md` | `POST /v1/agents/upload`: attach files |
| `models.md` | `GET /v1/agents/models` |
| `learn.md` | `POST /v1/agents/learn`: learn jobs, running the code (research preview) |
| `judge.md` | `POST /v1/agents/judge`: check turns against criteria (research preview) |
| `controll.md` | `/v1/machines/{machineId}/control`: open, exec, interrupt, close (research preview) |

### `references/sdks/`: SDK and examples

| File | Read it for |
| --- | --- |
| `ts-sdk.md` | The TypeScript SDK (`@simular-ai/sai-sdk`): tasks, events, approvals, files, typed output, learn, control, and Organisations/Tenants ("Run Sai for your customers"). This is the one for this project. |
| `ts-example.md` | A short TypeScript loop: poll events, `decide()` approvals, upload a file, typed output, abort |

### Organisations (online only, not saved here)

To run Sai for many end users (one Tenant per app user), fetch these pages before you build that part:

| Page | Covers |
| --- | --- |
| https://platform.simular.ai/documentation/organisations | Overview of Organisations |
| https://platform.simular.ai/documentation/organisations/orgs | The Organisation itself and its usage |
| https://platform.simular.ai/documentation/organisations/keys | Organisation Keys |
| https://platform.simular.ai/documentation/organisations/tenants | Tenants (one per customer or app user) |
| https://platform.simular.ai/documentation/organisations/session-spend | What each Tenant session spent |
| https://platform.simular.ai/documentation/organisations/enrollment | Enrolling a Tenant's own computer |
| https://platform.simular.ai/documentation/organisations/tenant-machines | A Tenant's machines |
| https://platform.simular.ai/documentation/organisations/cloud-machines | Cloud machines Sai hosts for a Tenant |
| https://platform.simular.ai/documentation/organisations/tenant-tokens | Exchanging the Organisation Key for a one-hour Tenant token |
| https://platform.simular.ai/documentation/organisations/runtime | Running tasks as a Tenant |

## Facts that shape the design

- **Base URL and auth:** `https://api.simular.ai` with `Authorization: Bearer sapi_...`. Keep the key on the server, in the agent's env.
- **Loop:**
  1. `POST /message` with `wait: false` returns a `sessionId`.
  2. Poll `GET /events?sessionId=&since=<cursor>&wait=30`.
  3. Stop when status is `idle` (the answer is in `text`) or `error`.
  4. When it's `needs_approval`, answer with `POST /approve` (`yes`, or `task` for the rest of the task), or open `approvalUrl` if `isLinkOnly`.
  5. The TypeScript SDK's `session.run()` / `turn.wait({ onApproval })` does all of this.
- **Long-poll with `wait=30`.** A tight loop runs out of the 1200-per-hour `GET /events` limit in about 20 minutes.
- **One task per computer at a time.** A second message becomes a steer for the running task (`queued: true`). A message with `options` gets `409 session_busy`.
- **Sessions belong to an API key and a computer, not to your app's users.** Other keys on the account can still read them. To give each app user their own computer, logins and spending, use an Organisation: each user becomes a Tenant, the backend holds the Organisation Key and acts through Tenant tokens. See `references/sdks/ts-sdk.md`, `references/api-reference/authentication.md` and the Organisations pages above.
- **Live screen:** `POST /machines/{id}/live` returns `liveUrl`, a hosted page anyone with the link can use, which is good for handing a sign-in or captcha to the user. It also returns `websocketUrl`, a Guacamole stream for your own viewer, which is view-only if you send no input. Both URLs act as credentials.
- **Live screen in your own chat UI:** `websocketUrl` from `machines.live()` is an Apache Guacamole tunnel. Embed it with `Guacamole.WebSocketTunnel` + `Guacamole.Client`, sending no input so the view is read-only. It is the way to show the agent's screen in the frontend in real time. The events API itself carries no screenshots, only progress lines.
- **`autonomous: true`** runs a turn as if "allow for the whole task" had been answered up front, though link-only approvals still stop it. Never set it for a user's real accounts: a prompt-injected page would act unchecked.
- **Link-only approvals** (`service_connect` such as Google sign-in, `user_input` such as a site password, `phone_verification`) can't be answered by the API, which returns `409 link_only`. Give the user `approvalUrl` and keep long-polling. Answering a `choice` approval with `yes` but no `selections` counts as a deny.
- **Two status vocabularies:** `/events` reports `running | needs_approval | idle | error`. `/turns/{id}` reports `running | needs_input | finalizing | succeeded | failed`, plus `reason_code`. `finalizing` is not done yet.
- **Typed output:** `outputSchema` (JSON Schema, RE2 `pattern`), `inputs` for `{{name}}` templates, `successCriteria`, and `idempotencyKey` (one per unit of work, so a retry doesn't do the work twice). The checks read on-screen text, so treat a pass as evidence, not proof.
- **Stops that should not be retried:** `insufficient_credits`, `free_computer_time_exhausted`, and `403 spend_cap_reached` (scope `api_key` or `tenant`). Report them to the user instead of retrying.
- **Other calls:** `sai.files.upload` (up to 25 MB, attached with `attachments`), `turn.abort()`, `sai.models.list()` (the free plan is limited to `auto`), and `sai.account.get()` (don't call it inside the poll loop).
- **Cost:** `learn` turns a repeated task into code that reruns cheaper and faster. Start a new session when runs should not carry earlier context, because long sessions re-read their history.

## How to fit it into this eve project

- Add one eve tool, for example `computer_task`. It sends the task with the TypeScript SDK, waits, and returns only the final text, so the eve agent spends few tokens.
- Pass approvals and sign-ins on to the user: link-only approvals and the `liveUrl` go to the chat. Don't auto-answer anything that signs in, pays, sends or deletes, because a model tricked by a web page would otherwise act on the user's real accounts.
- Map each app user to their own Sai Tenant before you go multi-user. A single shared key would mix every user's conversation and logins on one computer.
- Prefer a real API (Composio connectors, `web_search`) when one exists. The overview says to "write code when a documented API or SDK does the job". Use Sai for sites and apps that have no API.
