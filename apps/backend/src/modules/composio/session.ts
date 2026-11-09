import type { Composio } from "@composio/core";
import { eq } from "drizzle-orm";
import type { Db } from "../../db";
import { user } from "../../db/schema";

/**
 * The user's Composio session (one per user, Composio's documented Platform pattern): created on first use with our
 * user id as Composio's user id, its id saved on the user row, and resumed after that. A session that no longer
 * exists on Composio's side is replaced.
 */
export async function userSession(db: Db, composio: Composio, userId: string) {
  const [row] = await db.select({ sid: user.composioSessionId }).from(user).where(eq(user.id, userId)).limit(1);
  if (row?.sid) {
    try {
      return await composio.use(row.sid);
    } catch {
      // gone on Composio's side: make a new one below
    }
  }
  // The Connect page is the only place a user connects apps, so in-chat connection prompts stay off. The sandbox is
  // off so Composio's remote bash / workbench tools (code execution) never exist for our users.
  const session = await composio.create(userId, { manageConnections: false, sandbox: { enable: false } });
  await db.update(user).set({ composioSessionId: session.sessionId }).where(eq(user.id, userId));
  return session;
}

/** Pages a connection may return to: the builder and the dashboard, nothing else. */
const RETURN_PATH = /^\/(workflows|dashboard)(\/[A-Za-z0-9_-]+)*\/?$/;

/**
 * Where Composio sends the user after they authorize an app: always our own web app, never a URL from the request
 * (that would make the Connect Link an open redirect to any site). `returnTo` is only a path on our site, checked
 * against RETURN_PATH; anything else goes back to the Connect page.
 */
export function connectCallback(webOrigin: string, toolkit: string, returnTo?: string) {
  const path = returnTo && RETURN_PATH.test(returnTo) ? returnTo : "/dashboard/connect";
  const url = new URL(path, webOrigin);
  url.searchParams.set("connected", toolkit);
  return url.toString();
}
