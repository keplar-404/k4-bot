import { interrupt } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";
import type { AccountOptions } from "../../agent/account-tools";
import { composioFor } from "../../composio/client";
import { listConnections, type UserConnection } from "../../composio/connections";
import type { ComputerStub } from "../sandbox-backend";
import type { ScreenHolder } from "./screen";

const label = (c: UserConnection) => c.account ?? c.id;

/** The account the user named in their reply: its number in the list, its label or its id. */
export function pickAccount(accounts: UserConnection[], reply: string): UserConnection | undefined {
  const text = reply.trim().toLowerCase();
  const n = Number.parseInt(text, 10);
  if (String(n) === text && accounts[n - 1]) return accounts[n - 1];
  return accounts.find((c) => c.id.toLowerCase() === text) ?? accounts.find((c) => text.includes(label(c).toLowerCase()));
}

/**
 * Opens a page in the bot's browser profile for one connected app account. Composio's tokens never reach the
 * computer: the login there is a normal browser login, made once (by the user taking control) and kept per account.
 * Disconnecting the app deletes it (UserComputer.forgetAppAccount).
 */
export function createAppLoginTool(o: { computer: ComputerStub; botId: string; runId: string; screen: ScreenHolder; account: AccountOptions }) {
  return tool(
    async ({ toolkit, url, account }) => {
      const app = o.account.apps.find((a) => a.toolkit === toolkit);
      if (!app) return `You do not have the ${toolkit} app. Ask the user to add it to you on your settings page.`;
      const all = await listConnections(composioFor(o.account.env), o.account.userId);
      const accounts = all.filter((c) => c.toolkit === toolkit && c.status === "ACTIVE" && (!app.connectedAccountId || c.id === app.connectedAccountId));
      if (accounts.length === 0) return `${toolkit} is not connected. Call request_app_connections for it first.`;

      let chosen = account ? pickAccount(accounts, account) : accounts.length === 1 ? accounts[0] : undefined;
      if (!chosen) {
        // Re-asked if the run resumes from the top: listing is a read, so that is safe.
        const list = accounts.map((c, i) => `${i + 1}. ${label(c)}`).join("\n");
        const reply = interrupt({ kind: "info", question: `Which ${toolkit} account should I use?\n${list}` });
        chosen = pickAccount(accounts, String(reply));
        if (!chosen) return `The user's answer did not match an account (${accounts.map(label).join(", ")}). Ask again with ask_user.`;
      }

      const result = await o.computer.act(o.botId, o.runId, { action: "open_url", url, app: { toolkit, accountId: chosen.id } });
      if (result.screenshot) o.screen.latest = result.screenshot;
      if (!result.ok) return `NOT DONE: ${result.text}`;
      return `${result.text} Account: ${label(chosen)}. If the page asks to sign in, use ask_user (kind "credentials") so the user can take control and log in once; this window remembers it. The screenshot is attached below.`;
    },
    {
      name: "open_app_in_browser",
      description:
        "Open a page of one of your connected apps (Gmail, Notion, …) in the computer's browser, signed in as that app's account. " +
        "Use it instead of the computer tool's open_url when the page needs the user's login. If the user has several accounts for the app, they are asked which.",
      schema: z.object({
        toolkit: z.string().max(64).describe("The app's id, e.g. gmail, notion, github."),
        url: z.string().max(2048).describe("The http(s) page to open, e.g. https://mail.google.com."),
        account: z.string().max(200).optional().describe("Which account (its email or name) when you already know."),
      }),
    },
  );
}
