# Secrets

The **Secrets page** (`/dashboard/secrets`) is an encrypted vault for API keys and private values that your
**workflows** need: a Stripe key for an HTTP request block, a bearer token for an internal API, a password a service
needs.

## Why it exists

A workflow often needs a credential that is not a Composio connection. Typing it into a block would store it in the
graph, show it in run logs and (in a bot-built workflow) pass it through the model. Instead:

1. Save it once here as `NAME` (UPPER_SNAKE_CASE), or let a bot ask for it with `request_secret`, which shows a secure
   form in the chat. Either way the value goes from your browser straight to the server.
2. Use it in an **App action** or **HTTP request** block as `{{secrets.NAME}}`.
3. At run time the engine decrypts it on the server for that one call only.

## Guarantees

- Encrypted with AES-256-GCM, bound to your user and that row; the key (`SECRETS_ENCRYPTION_KEY`) is never in the database.
- Never sent to a bot or a model, never returned to the browser (only its last 4 characters are shown).
- Scrubbed from everything a run stores or shows: replaced by `[secret:NAME]`.
- Refused anywhere it could leak (conditions, Set fields, AI prompts): publishing fails with a clear message.
- Cannot be deleted while a workflow uses it (the error names the workflows).

If the server has no `SECRETS_ENCRYPTION_KEY`, the vault answers "Secrets are not set up on this server."

## API

`GET /api/v1/secrets` (names, labels, last 4 characters), `PUT /api/v1/secrets/:name {value, label?}`,
`DELETE /api/v1/secrets/:name`. Details: [Security](../architecture/security.md#secrets).
