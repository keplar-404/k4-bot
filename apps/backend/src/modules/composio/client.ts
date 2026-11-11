import { Composio } from "@composio/core";

/** The API key is missing: the Connect feature is off (routes answer 503). */
export class ComposioNotConfigured extends Error {}

/** A toolkit slug as Composio writes them ("gmail", "google_drive", "0codekit"). Anything else is refused. */
export const TOOLKIT_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const clients = new Map<string, Composio>();

/** One client per key per isolate: it holds no user state, so it is safe to share. */
export function composioFor(env: { COMPOSIO_API_KEY?: string }): Composio {
  const key = env.COMPOSIO_API_KEY;
  if (!key) throw new ComposioNotConfigured("COMPOSIO_API_KEY is not set.");
  let client = clients.get(key);
  if (!client) clients.set(key, (client = new Composio({ apiKey: key })));
  return client;
}

/**
 * One Composio session per user (cached per isolate): sessions scope tools, auth and execution to a
 * user. Enabled with COMPOSIO_SESSIONS=true; the direct path stays the default until a deployment
 * verifies session executes against its connected accounts.
 */
const sessions = new Map<string, Promise<unknown>>();
export function sessionFor(env: { COMPOSIO_API_KEY?: string; COMPOSIO_SESSIONS?: string }, userId: string): Promise<unknown> {
  if (env.COMPOSIO_SESSIONS !== "true") return Promise.reject(new Error("COMPOSIO_SESSIONS is off"));
  let session = sessions.get(userId);
  if (!session) {
    session = composioFor(env).create(userId);
    sessions.set(userId, session);
    session.catch(() => sessions.delete(userId));
  }
  return session;
}

/** The SDK's typed client drops list cursors; the raw API client (`composio.client`) keeps them. */
type RawList<T> = { items: T[]; next_cursor?: string | null };
type RawClient = {
  toolkits: {
    list(q: { limit?: number; cursor?: string; sort_by?: "usage" | "alphabetically" }): Promise<RawList<RawToolkit>>;
  };
  files: {
    createPresignedURL(body: {
      toolkit_slug: string;
      tool_slug: string;
      filename: string;
      mimetype: string;
      md5: string;
    }): Promise<{ key: string; new_presigned_url: string }>;
  };
};
export type RawToolkit = {
  slug: string;
  name: string;
  no_auth?: boolean;
  auth_schemes?: string[];
  meta?: {
    description?: string;
    logo?: string;
    categories?: Array<{ id: string; name: string }>;
    tools_count?: number;
    triggers_count?: number;
  };
};

export const rawClient = (c: Composio) => (c as unknown as { client: RawClient }).client;
