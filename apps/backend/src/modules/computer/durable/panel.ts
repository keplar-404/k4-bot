import type { ActivityEvent } from "../types";
import { ComputerBots } from "./bots";
import { CONTROL, VIEW } from "./constants";

/** What the user's computer panel sees: the Activity feed, the live view's target and the status socket. */
export class ComputerPanel extends ComputerBots {
  protected note(botId: string, text: string) {
    const event: ActivityEvent = { botId, text, at: Date.now() };
    this.tables.addActivity(event);
    this.broadcast({ type: "activity", event });
  }

  /**
   * Records what a bot did with the shell or files for the Activity feed (the screen actions are noted
   * in `act`). Storage and a socket broadcast only: it never touches E2B. Called by the run workflow.
   */
  async logActivity(botId: string, text: string): Promise<void> {
    if (this.tables.isRemoved(botId)) return;
    this.note(botId, text.replace(/\s+/g, " ").slice(0, 160));
  }

  /** Where the Worker proxy should connect. Never wakes a sleeping computer (that costs money). */
  async viewerTarget(mode: "watch" | "control"): Promise<{ host: string; token: string } | { error: string }> {
    if (this.state !== "running") return { error: "asleep" };
    if (mode === "control" && this.holder()?.kind !== "user") return { error: "not_in_control" };
    try {
      // After a Durable Object eviction the VM is still running: reconnecting to it costs nothing.
      const sbx = this.sbx ?? (await this.live());
      await this.ensureVnc(sbx);
      return { host: sbx.getHost((mode === "watch" ? VIEW : CONTROL).web), token: sbx.trafficAccessToken ?? "" };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "unavailable" };
    }
  }

  /** The panel's status and activity socket. */
  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== "/ws" || request.headers.get("Upgrade") !== "websocket") {
      return new Response("Not found", { status: 404 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify({ type: "status", status: await this.status() }));
    pair[1].send(JSON.stringify({ type: "activity-batch", events: this.tables.recentActivity() }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string) {
    // 1005/1006 only describe how the peer went away; they may not be sent back (the runtime throws).
    ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
  }
}
