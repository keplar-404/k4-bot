import type { Context } from "hono";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "../../db";
import { botComposioApp } from "../../db/schema";
import type { Env } from "../../config/env";
import { composioFor } from "../composio/client";
import { listConnections } from "../composio/connections";

export type ComposioAppInput = { toolkit: string; connectedAccountId?: string; allowWrites?: boolean };
export type SaveResult = { ok: true } | { ok: false; status: 400 | 502 | 503; message: string };

/** The Composio apps of these bots (one query), for the bot form. */
export async function composioAppsOf(db: Db, botIds: string[]) {
  if (botIds.length === 0)
    return new Map<string, Array<{ toolkit: string; connectedAccountId?: string; allowWrites: boolean }>>();
  const rows = await db.select().from(botComposioApp).where(inArray(botComposioApp.botId, botIds));
  const out = new Map<string, Array<{ toolkit: string; connectedAccountId?: string; allowWrites: boolean }>>();
  for (const r of rows) {
    const list = out.get(r.botId) ?? [];
    list.push({
      toolkit: r.toolkit,
      connectedAccountId: r.connectedAccountId ?? undefined,
      allowWrites: r.allowWrites,
    });
    out.set(r.botId, list);
  }
  return out;
}

/**
 * Checks the apps a form asks for BEFORE anything is written: an app is only allowed when the user has an ACTIVE
 * connection to it, and a named account must be one of theirs for that app (the form is never trusted). A failure to
 * ask Composio refuses the save instead of wiping the old list.
 */
export async function checkComposioApps(env: Env, userId: string, apps?: ComposioAppInput[]): Promise<SaveResult> {
  if (!apps?.length) return { ok: true };
  let active: Awaited<ReturnType<typeof listConnections>>;
  try {
    active = (await listConnections(composioFor(env), userId)).filter((c) => c.status === "ACTIVE");
  } catch {
    return { ok: false, status: 502, message: "Could not check your connected apps right now. Try again." };
  }
  for (const a of apps) {
    const mine = active.filter((c) => c.toolkit === a.toolkit);
    if (mine.length === 0)
      return {
        ok: false,
        status: 400,
        message: `Connect ${a.toolkit} on the Connect page before giving it to a bot.`,
      };
    if (a.connectedAccountId && !mine.some((c) => c.id === a.connectedAccountId))
      return { ok: false, status: 400, message: `That ${a.toolkit} account is not yours or not connected.` };
  }
  return { ok: true };
}

/** checkComposioApps as a route guard: the error response to return, or null to carry on. */
export async function composioGate(c: Context, env: Env, userId: string, apps?: ComposioAppInput[]) {
  const checked = await checkComposioApps(env, userId, apps);
  return checked.ok ? null : c.json({ error: "INVALID_INPUT", message: checked.message }, checked.status);
}

/** Replaces a bot's Composio apps in one transaction (omitted = unchanged). Call checkComposioApps first. */
export async function saveBotComposioApps(db: Db, botId: string, apps?: ComposioAppInput[]) {
  if (apps === undefined) return;
  const unique = [...new Map(apps.map((a) => [a.toolkit, a])).values()];
  await db.batch([
    db.delete(botComposioApp).where(eq(botComposioApp.botId, botId)),
    ...(unique.length
      ? [
          db.insert(botComposioApp).values(
            unique.map((a) => ({
              botId,
              toolkit: a.toolkit,
              connectedAccountId: a.connectedAccountId ?? null,
              allowWrites: a.allowWrites ?? true,
            })),
          ),
        ]
      : []),
  ] as Parameters<Db["batch"]>[0]);
}
