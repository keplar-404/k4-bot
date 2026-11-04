import { DurableObject } from "cloudflare:workers";
import { neon } from "@neondatabase/serverless";
import type { Env } from "../../../config/env";
import { checkConnect, isInternal } from "./access";
import { insertEvent, maxSeq, type RelayEvent, type Sql } from "./events";
import { broadcast, replay } from "./sockets";

/**
 * ChatRelay: one instance per chat thread.
 *
 * - Assigns a gap-free `seq` to every agent event and broadcasts it to the
 *   thread's hibernating WebSockets.
 * - Persists each event to `chat_event` before acknowledging it, so the
 *   database (not memory) is the source of truth for replay. A reconnecting
 *   client resumes from its last `seq`; if it is too far behind it is told to
 *   reload history over HTTP.
 *
 * The thread id lives in Durable Object storage: instance fields are lost on
 * hibernation/eviction, and the sequence counter is derived from it.
 */
export class ChatRelayDurableObject extends DurableObject<Env> {
  private readonly sql: Sql;
  private threadId = "";
  /** Last assigned seq; null until restored from the database. */
  private seq: number | null = null;
  private restoring: Promise<void> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = neon(env.DATABASE_URL);
    ctx.blockConcurrencyWhile(async () => {
      this.threadId = (await ctx.storage.get<string>("threadId")) ?? "";
    });
  }

  /** Must run before anything reads or writes the sequence. */
  private async bind(threadId: string) {
    if (this.threadId === threadId) return;
    this.threadId = threadId;
    this.seq = null;
    await this.ctx.storage.put("threadId", threadId);
  }

  /** Restores the counter after eviction. A failed attempt is retried, never latched. */
  private async ensureSeq() {
    if (this.seq !== null) return;
    this.restoring ??= maxSeq(this.sql, this.threadId)
      .then((seq) => void (this.seq = seq))
      .finally(() => (this.restoring = null));
    await this.restoring;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/connect") {
      const checked = await checkConnect(this.env, request, url);
      if (checked instanceof Response) return checked;
      await this.bind(checked.threadId);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      await this.ensureSeq();
      await replay(pair[1], this.sql, this.threadId, Number(url.searchParams.get("lastSeq") ?? Number.NaN), this.seq!);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === "/publish" && request.method === "POST") {
      if (!isInternal(this.env, request)) return new Response("Forbidden", { status: 403 });
      const body = (await request.json()) as { threadId: string; type: string; payload: unknown };
      await this.bind(body.threadId);
      return Response.json({ seq: (await this.append(body.type, body.payload)).seq });
    }
    return new Response("Not found", { status: 404 });
  }

  private async append(type: string, payload: unknown): Promise<RelayEvent> {
    await this.ensureSeq();
    // No await between here and the increment, so concurrent appends cannot share a seq.
    const event: RelayEvent = { seq: ++this.seq!, type, payload, ts: Date.now() };

    broadcast(this.ctx.getWebSockets(), { type: "event", event });
    await insertEvent(this.sql, this.threadId, event);
    return event;
  }

  /** The user pressed Stop on this run. RPC: only this Worker's own binding can call it. */
  async requestStop(runId: string): Promise<void> {
    await this.ctx.storage.put(`stop:${runId}`, Date.now());
  }

  /** Whether Stop was pressed for this run (polled by its running slice). */
  async stopRequested(runId: string): Promise<boolean> {
    return (await this.ctx.storage.get(`stop:${runId}`)) !== undefined;
  }

  /**
   * The thread was deleted (with its bot): close its live sockets and drop this object's storage.
   * RPC, so only this Worker's own binding can call it. Its events are rows that cascade in Postgres.
   */
  async purge(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) ws.close(4404, "thread deleted");
    await this.ctx.storage.deleteAll();
    this.threadId = "";
    this.seq = null;
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string) {
    // 1005/1006 only describe how the peer went away; they may not be sent back (the runtime throws).
    ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
  }
}
