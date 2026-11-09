import type { Composio } from "@composio/core";
import type { Env } from "../../config/env";
import { composioFor } from "./client";
import { listConnections } from "./connections";

/** A kind of event an app can start a workflow with, and what it needs and sends (JSON Schema). */
export type TriggerType = {
  slug: string;
  name: string;
  description: string;
  /** "webhook": the app pushes events at once. "poll": Composio checks every few minutes. */
  delivery: string;
  config: Record<string, unknown>;
  payload: Record<string, unknown>;
};

type RawTriggerType = {
  slug: string;
  name?: string;
  description?: string;
  type?: string;
  config?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

const TTL_MS = 60 * 60_000;
const cache = new Map<string, { at: number; value: TriggerType[] }>();

const toType = (t: RawTriggerType): TriggerType => ({
  slug: t.slug,
  name: t.name ?? t.slug,
  description: (t.description ?? "").trim().slice(0, 400),
  delivery: t.type ?? "webhook",
  config: t.config ?? {},
  payload: t.payload ?? {},
});

/** Every trigger type of one app, with schemas. Cached per isolate for an hour: catalogs change rarely. */
export async function listTriggerTypes(composio: Composio, toolkit: string): Promise<TriggerType[]> {
  const hit = cache.get(toolkit);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const res = (await composio.triggers.listTypes({ toolkits: [toolkit], limit: 200 } as never)) as unknown as {
    items: RawTriggerType[];
  };
  const value = res.items.map(toType).sort((a, b) => a.name.localeCompare(b.name));
  cache.set(toolkit, { at: Date.now(), value });
  return value;
}

export async function getTriggerType(composio: Composio, slug: string): Promise<TriggerType> {
  return toType((await composio.triggers.getType(slug)) as unknown as RawTriggerType);
}

/**
 * Starts listening for one app event for this user: a Composio trigger instance on the user's own ACTIVE account
 * (the one named, or the only one). Composio "upserts", so the same event, account and config give back the same
 * instance, which several workflows may then share. Returns the instance id, or the reason it cannot start.
 */
export async function startAppTrigger(
  env: Env,
  userId: string,
  setup: { toolkit: string; trigger: string; config: Record<string, unknown>; connectedAccountId?: string },
): Promise<{ triggerId: string } | { error: string }> {
  const composio = composioFor(env);
  const type = await getTriggerType(composio, setup.trigger);
  if (!(await listTriggerTypes(composio, setup.toolkit)).some((t) => t.slug === type.slug)) {
    return { error: `${setup.trigger} is not an event of ${setup.toolkit}.` };
  }

  const mine = (await listConnections(composio, userId)).filter(
    (c) => c.toolkit === setup.toolkit && c.status === "ACTIVE",
  );
  const account = setup.connectedAccountId
    ? mine.find((c) => c.id === setup.connectedAccountId)
    : mine.length === 1
      ? mine[0]
      : undefined;
  if (!account) {
    if (mine.length > 1) return { error: `Choose which ${setup.toolkit} account to watch.` };
    return { error: `Connect ${setup.toolkit} first, then turn the workflow on.` };
  }

  const created = await composio.triggers.create(userId, setup.trigger, {
    connectedAccountId: account.id,
    triggerConfig: setup.config,
  });
  return { triggerId: created.triggerId };
}

/** Stops listening. An instance that is already gone is fine. */
export async function stopAppTrigger(env: Env, triggerId: string) {
  try {
    await composioFor(env).triggers.delete(triggerId);
  } catch (error) {
    console.error("[composio] could not delete trigger", triggerId, (error as Error).message);
  }
}
