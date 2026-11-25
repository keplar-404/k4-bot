# Computers

Where Sai works, and how the API picks one.

Sai runs on a computer. The API calls it a machine and identifies it by `machineId`. It can be a computer Simular hosts for you, or your own Mac or Windows PC. The API calls are the same for both.

## Kinds

| `kind`  | What it is                                                      |
| ------- | --------------------------------------------------------------- |
| `cloud` | A Windows or Linux computer Simular hosts for you.              |
| `own`   | Your own Mac or Windows computer, with the Sai Agent installed. |

`GET /machines` returns every computer on your account with its `kind` and whether it is `online`. See [Machines](/documentation/api-reference/machines).

## Free accounts

A free account has one pooled Windows cloud computer. It has no entry of its own until Sai first uses it, so `/machines` lists it under a derived id:

```json title="Free computer in /machines"
{
  "machineId": "free-3fA9kQ2xYz",
  "name": "Sai cloud computer (free)",
  "kind": "cloud",
  "online": false
}
```

The id is `free-` followed by your user id. It never changes. You can pass it as `machineId`, or omit `machineId` and let the API pick it.

The computer starts when the first message arrives. Expect the first request of the day to take about two minutes before events begin. Free accounts have a daily time limit on the computer; the portal shows the remaining time.

## Getting a computer

- **Free plan**: nothing to do. The pooled computer starts on the first task that needs it.
- **Paid plan, no computer yet**: create one with the **Create a Windows computer** or **Create a Linux computer** button in the [Playground](https://platform.simular.ai/playground), or in the Sai app. It takes a few minutes. See [Create a computer](/documentation/api-reference/machines#create-a-computer).

- **Your own computer, any plan**: on that computer, sign in at [sai.simular.ai](https://sai.simular.ai) with the same account, open **Add computer → Your Device** (or **Settings → Computers → Connect your device**), download the Sai Agent for macOS or Windows, run it and sign in. It appears in `/machines` with `"kind": "own"`.

If your code or coding agent hits "this account has no computer yet", send the user to the Playground or to the Sai Agent download; an API key cannot create or connect one.

## Your own computer

Sai works on your own computer the way it works on a cloud one: it sees the screen, clicks and types, with your apps, files and browser sign-ins. Keep in mind:

- Sai works on it only while the Sai Agent is running and the computer is awake. `/machines` reports `online: false` otherwise. Unlike a cloud computer, the API cannot wake it.
- [Direct control](/documentation/concepts/direct-control) and [learn jobs](/documentation/api-reference/learn#learn-jobs) use your real screen, mouse and keyboard, so leave the computer alone while they run.
- Direct control and learn jobs run code sent with your API key, so they are off on your own computer until you turn them on. Until then they answer `403 own_computer_access_off`. Sai tasks (`POST /message`) don't need this.

### Turn on code on your own computer

Code sent this way runs as you on that computer, with your files and signed-in apps. Turn it on only for an account whose API keys you keep safe.

On [platform.simular.ai](https://platform.simular.ai), open **API keys** and tick **Let your keys run code on your own computers**. An API key cannot turn it on. The portal calls this endpoint with your signed-in session (as for [Keys](/documentation/api-reference/keys)):

```bash title="Turn on code on your own computer"
curl -s -X PUT "$SAI_API_URL/v1/account/own-computer-access" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true }'
```

`GET` on the same path returns `{ "enabled": true }` or `false`. Turning it off stops new leases and learn jobs; one already open runs until it ends or you cancel it.

## Picking a computer

`machineId` is optional on `POST /message`.

- Omitted with one computer: the API uses it.
- Omitted on a free account: the API uses `free-{uid}`.
- Omitted with several computers: `400` with `machines: [{ machineId, name }]` listing the candidates. Pass one of them.
- Omitted on a paid account with no computer: `400` asking you to create one.

Send a `machineId` that is not yours and the API answers `403`.

> **Note**
>
> Optional `machineId` and the free-account row in `/machines` are available from October 1. Against today's staging, pass `machineId` on every message.

## Waking and restarting

Cloud computers hibernate when idle. `POST /message` wakes one as part of delivery, so you do not have to call anything first. `POST /wake` and `POST /restart` exist for the Sai CLI and are not needed for the loop on this site.
