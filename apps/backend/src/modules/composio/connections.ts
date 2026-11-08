import type { Composio } from "@composio/core";

/** A user's connection to one app, as the web app sees it (never the provider's credentials). */
export type UserConnection = {
  id: string;
  toolkit: string;
  /** ACTIVE works; EXPIRED / FAILED / INACTIVE / REVOKED need a reconnect; INITIATED / INITIALIZING are unfinished. */
  status: string;
  /** Which account it is (an email or a name), when the provider tells. */
  account: string | null;
  createdAt: string;
};

type RawAccount = {
  id: string;
  status: string;
  alias?: string | null;
  toolkit: { slug: string };
  state?: { val?: Record<string, unknown> };
  createdAt: string;
};

/**
 * `state` can hold the provider's tokens, so only these display fields are ever read from it. Everything else
 * stays inside Composio.
 */
const LABEL_FIELDS = [
  "email",
  "account_email",
  "user_email",
  "username",
  "user_name",
  "name",
  "displayName",
  "display_name",
];

function accountLabel(a: RawAccount): string | null {
  if (a.alias) return a.alias.slice(0, 120);
  const val = a.state?.val ?? {};
  for (const key of LABEL_FIELDS) {
    const v = val[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
  }
  return null;
}

/** Every connection the user owns (Composio filters by our user id; accounts are PRIVATE to that user). */
export async function listConnections(composio: Composio, userId: string): Promise<UserConnection[]> {
  const out: UserConnection[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = (await composio.connectedAccounts.list({
      userIds: [userId],
      limit: 100,
      cursor,
      orderBy: "updated_at",
    })) as unknown as {
      items: RawAccount[];
      nextCursor?: string | null;
    };
    for (const a of res.items) {
      out.push({
        id: a.id,
        toolkit: a.toolkit.slug,
        status: a.status,
        account: accountLabel(a),
        createdAt: a.createdAt,
      });
    }
    cursor = res.nextCursor ?? undefined;
    if (!cursor) break;
  }
  return out;
}

/** The user's own connection with this id, or null: the ownership check before any change to it. */
export async function ownConnection(composio: Composio, userId: string, id: string): Promise<UserConnection | null> {
  return (await listConnections(composio, userId)).find((c) => c.id === id) ?? null;
}
