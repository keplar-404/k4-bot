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
      // E2B pauses a VM on its own (its timeout ran out while this object thought it was running): say it is asleep,
      // so the panel shows its wake button instead of trying to connect to a screen that is not there.
      if (!(await sbx.isRunning({ requestTimeoutMs: 5000 }).catch(() => false))) {
        this.sbx = undefined;
        await this.setState("paused", "Your computer went to sleep. Wake it to see the screen.");
        return { error: "asleep" };
      }
      await this.ensureVnc(sbx);
      return { host: sbx.getHost((mode === "watch" ? VIEW : CONTROL).web), token: sbx.trafficAccessToken ?? "" };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "unavailable" };
    }
  }

  /**
   * The bot accounts on the computer and their home sizes (KB), read from the machine itself. Null while it is not
   * running: listing accounts never wakes it (that costs computer time).
   */
  async accountsOnDisk(): Promise<Array<{ user: string; kb: number }> | null> {
    if (this.state !== "running") return null;
    const sbx = this.sbx ?? (await this.live());
    // Bot accounts are named u_<id>; du runs as root because each home is private to its bot.
    const out = await sbx.commands.run(
      "for h in /home/u_*; do [ -d \"$h\" ] && du -sk \"$h\"; done 2>/dev/null || true",
      { user: "root", timeoutMs: 20_000 },
    );
    return out.stdout
      .split("\n")
      .map((line) => line.trim().split(/\s+/))
      .filter(([kb, path]) => kb && path?.startsWith("/home/u_"))
      .map(([kb, path]) => ({ user: path!.slice("/home/".length), kb: Number(kb) || 0 }));
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
