/**
 * Points the Composio project's event delivery at this API, once per environment:
 *
 *   bun run composio:webhook https://api.example.com
 *
 * Composio then POSTs every app event (Slack message, new email…) to <url>/api/v1/composio/events, signed. Store the
 * printed secret as the Worker secret COMPOSIO_WEBHOOK_SECRET (`wrangler secret put COMPOSIO_WEBHOOK_SECRET`); the
 * API refuses events without it. Running it again updates the URL and keeps one subscription per project.
 *
 * Local development: Composio cannot reach localhost. Forward events with the Composio CLI instead:
 *   composio dev triggers listen --forward http://127.0.0.1:8787/api/v1/composio/events
 */
import { Composio } from "@composio/core";

const base = process.argv[2];
if (!base || !/^https:\/\/[^/]+/.test(base)) {
  console.error("Usage: bun run composio:webhook https://<your public API host>");
  process.exit(1);
}

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const subscription = await composio.webhooks.subscriptions.set({
  webhookUrl: `${base.replace(/\/$/, "")}/api/v1/composio/events`,
  enabledEvents: ["composio.trigger.message", "composio.connected_account.expired"],
  version: "V3",
});
console.log(`Events now go to ${subscription.webhookUrl}`);
console.log("Store this as the Worker secret COMPOSIO_WEBHOOK_SECRET (it is shown here only):");
console.log(subscription.secret);
