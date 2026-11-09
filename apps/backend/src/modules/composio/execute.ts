import type { Env } from "../../config/env";
import { allow } from "../../middleware/rate-limit";
import { fitArguments } from "./arguments";
import { composioFor } from "./client";
import { listConnections } from "./connections";
import { getTool } from "./tools";

export type ActionResult = { ok: true; data: unknown } | { ok: false; error: string; fatal: boolean };

type ActionArgs = {
  userId: string;
  toolkit: string;
  slug: string;
  version?: string;
  arguments: Record<string, unknown>;
  connectedAccountId?: string;
  maxChars: number;
};

/** Composio's error text for problems a retry cannot fix: bad input, a missing tool, no permission. */
const FATAL_ERROR_TEXT = /\b4\d\d\b|invalid|not found|unauthori[sz]ed|forbidden|required|permission|missing/i;
/** SDK error names that are about the request, not a network or server hiccup. */
const FATAL_SDK_ERROR = /Invalid|NotFound|Required|Multiple|Blocked/;

const failed = (error: string, fatal = true): ActionResult => ({ ok: false, error, fatal });

/** Cuts a result to `max` characters of JSON. A cut one says so, so nobody trusts half an answer. */
function clip(data: unknown, max: number): unknown {
  const text = JSON.stringify(data ?? null);
  if (text.length <= max) return data;
  return { truncated: true, preview: text.slice(0, max) };
}

/**
 * The one place a Composio action runs, for bots and workflow blocks alike, always as the owner:
 * - the action must belong to the app the caller names;
 * - the account must be the user's own and ACTIVE (the only one for that app, when none is named);
 * - the tool version is pinned (Composio refuses "latest" for direct execution);
 * - every call is rate limited per user.
 */
export async function executeAction(env: Env, args: ActionArgs): Promise<ActionResult> {
  try {
    if (!(await allow(env, "RL_APP_EXEC", args.userId))) {
      return failed("Slow down: the app action limit was reached. Try again in a minute.", false);
    }

    const composio = composioFor(env);
    const tool = await getTool(composio, args.slug);
    if (tool.toolkit !== args.toolkit) return failed(`${args.slug} is not an action of ${args.toolkit}.`);
    const version = args.version ?? tool.version;
    if (!version) return failed("This action has no version to run.");

    const fitted = fitArguments(tool.input, args.arguments);
    if ("missing" in fitted) return failed(`Fill in: ${fitted.missing.join(", ")}.`);

    const account = await pickAccount(env, args);
    if ("error" in account) return failed(account.error);

    const res = await composio.tools.execute(args.slug, {
      userId: args.userId,
      connectedAccountId: account.id,
      arguments: fitted.args,
      version,
    });
    if (!res.successful) {
      const error = res.error ?? "The action failed.";
      // The log id finds this call in Composio's dashboard logs; it never goes to the model or the user.
      console.warn("[composio] action failed", args.slug, res.logId);
      return failed(error.slice(0, 500), FATAL_ERROR_TEXT.test(error));
    }
    return { ok: true, data: clip(res.data, args.maxChars) };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    console.error("[composio] execute failed", args.slug, name, (error as Error)?.message);
    return failed("The app did not answer. Try again.", FATAL_SDK_ERROR.test(name));
  }
}

/** The user's own ACTIVE account for the app: the one named, or the only one there is. */
async function pickAccount(env: Env, args: ActionArgs): Promise<{ id: string } | { error: string }> {
  const connections = await listConnections(composioFor(env), args.userId);
  const mine = connections.filter((c) => c.toolkit === args.toolkit && c.status === "ACTIVE");

  if (args.connectedAccountId) {
    const named = mine.find((c) => c.id === args.connectedAccountId);
    if (named) return named;
    return { error: `That ${args.toolkit} account is not connected. Reconnect it on the Connect page.` };
  }
  if (mine.length === 1) return mine[0]!;
  if (mine.length === 0) return { error: `Connect ${args.toolkit} on the Connect page first.` };
  return { error: `Choose which ${args.toolkit} account to use.` };
}
