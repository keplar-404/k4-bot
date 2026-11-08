import { DurableObject } from "cloudflare:workers";
import type { Env } from "../../../config/env";
import { verifyRelayToken } from "../../../shared/relay-token";
import type { LiveEvent } from "./events";
import { liveScope } from "./token";

/** More tabs than this on one workflow is a leak or abuse: the oldest socket is closed. */
const MAX_SOCKETS = 20;

/**
 * WorkflowRunRelay: one instance per workflow. Every open builder tab of that workflow holds one socket here, and the
 * run engine pushes each step change to it. Nothing is stored: the database is the record, the socket only makes the
 * canvas update at once. A tab that reconnects reloads the run from the API.
 */
export class WorkflowRunRelay extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const workflowId = url.searchParams.get("workflowId") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    const token = url.searchParams.get("token") ?? "";
    const valid = await verifyRelayToken({
      secret: this.env.WS_TOKEN_SECRET ?? this.env.BETTER_AUTH_SECRET,
      token,
      userId,
      threadId: liveScope(workflowId),
    });
    if (!valid) return new Response("Invalid token", { status: 401 });

    const open = this.ctx.getWebSockets();
    if (open.length >= MAX_SOCKETS) open[0]?.close(4008, "too many tabs");

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server!);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Sends one event to every open tab. RPC: only this Worker's own binding can call it. */
  async broadcast(event: LiveEvent): Promise<void> {
    const frame = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(frame);
      } catch {
        // A socket that is closing: it is gone on the next call.
      }
    }
  }

  /** The workflow was deleted: its open builders are told and closed. */
  async closeAll(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) ws.close(4404, "workflow deleted");
  }

  // Clients only listen; anything they send is ignored.
  override webSocketMessage() {}

  override webSocketClose(ws: WebSocket, code: number, reason: string) {
    // 1005/1006 only describe how the peer went away; they may not be sent back (the runtime throws).
    ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
  }
}
