import type { Env } from "../../../config/env";
import { timingSafeEqualString, verifyRelayToken } from "../../../shared/relay-token";

const secretOf = (env: Env) => env.WS_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET;

/** A /connect request's thread and user, or the response that refuses it. */
export async function checkConnect(env: Env, request: Request, url: URL): Promise<{ threadId: string } | Response> {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }
  const threadId = url.searchParams.get("threadId") ?? "";
  const userId = url.searchParams.get("userId") ?? "";
  if (!threadId || !userId) return new Response("Missing threadId or userId", { status: 400 });

  const valid = await verifyRelayToken({ secret: secretOf(env), token: url.searchParams.get("token") ?? "", userId, threadId });
  if (!valid) return new Response("Invalid token", { status: 401 });
  return { threadId };
}

/**
 * /publish is reachable only through this Worker's own bindings (the public route forwards a fixed /connect
 * target); the secret is defence in depth.
 */
export function isInternal(env: Env, request: Request): boolean {
  const provided = request.headers.get("x-internal-secret");
  return Boolean(provided && timingSafeEqualString(provided, secretOf(env)));
}
