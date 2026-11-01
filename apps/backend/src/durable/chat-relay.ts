import { DurableObject } from "cloudflare:workers";
import { neon } from "@neondatabase/serverless";
import { timingSafeEqualString, verifyRelayToken } from "../lib/relay-token";
import type { Env } from "../lib/env";

export interface RelayEvent {
  seq: number;
  type: string;
  payload: unknown;
  ts: number;
}

/** Most events replayed to a reconnecting socket before it must reload history. */
const RESUME_LIMIT = 500;

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
  private readonly sql: ReturnType<typeof neon>;
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
    this.restoring ??= (async () => {
      const [row] = (await this.sql`
        SELECT COALESCE(MAX(seq), 0) AS max_seq FROM chat_event WHERE thread_id = ${this.threadId}
      `) as Array<{ max_seq: number }>;
      this.seq = Number(row?.max_seq ?? 0);
    })().finally(() => {
      this.restoring = null;
    });
    await this.restoring;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const threadId = url.searchParams.get("threadId") ?? "";
      const userId = url.searchParams.get("userId") ?? "";
      if (!threadId || !userId) return new Response("Missing threadId or userId", { status: 400 });

      const valid = await verifyRelayToken({
        secret: this.env.WS_TOKEN_SECRET ?? this.env.BETTER_AUTH_SECRET,
        token: url.searchParams.get("token") ?? "",
        userId,
        threadId,
      });
      if (!valid) return new Response("Invalid token", { status: 401 });

      await this.bind(threadId);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      await this.sendResume(pair[1], Number(url.searchParams.get("lastSeq") ?? Number.NaN));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // Reachable only through this Worker's own bindings (the public route
    // forwards a fixed /connect target); the secret is defence in depth.
    if (url.pathname === "/publish" && request.method === "POST") {
      const provided = request.headers.get("x-internal-secret");
      const secret = this.env.WS_TOKEN_SECRET ?? this.env.BETTER_AUTH_SECRET;
      if (!provided || !timingSafeEqualString(provided, secret)) {
        return new Response("Forbidden", { status: 403 });
      }
      const body = (await request.json()) as { threadId: string; type: string; payload: unknown };
      await this.bind(body.threadId);
      return Response.json({ seq: (await this.append(body.type, body.payload)).seq });
    }

    return new Response("Not found", { status: 404 });
  }

  /**
   * Replays everything after `cursor`, then `ready`. A missing cursor means
   * "start from now"; a gap larger than RESUME_LIMIT means "reload history".
   */
  private async sendResume(ws: WebSocket, cursor: number) {
    await this.ensureSeq();
    const latest = this.seq!;

    if (Number.isNaN(cursor)) {
      ws.send(JSON.stringify({ type: "ready", seq: latest }));
      return;
    }

    const rows = (await this.sql`
      SELECT seq, type, payload, created_at FROM chat_event
      WHERE thread_id = ${this.threadId} AND seq > ${cursor}
      ORDER BY seq ASC LIMIT ${RESUME_LIMIT + 1}
    `) as Array<{ seq: number; type: string; payload: unknown; created_at: string }>;

    if (rows.length > RESUME_LIMIT) {
      ws.send(JSON.stringify({ type: "resync" }));
      return;
    }
    for (const r of rows) {
      const event: RelayEvent = {
        seq: Number(r.seq),
        type: r.type,
        payload: r.payload,
        ts: new Date(r.created_at).getTime(),
      };
      ws.send(JSON.stringify({ type: "event", event }));
    }
    ws.send(JSON.stringify({ type: "ready", seq: latest }));
  }

  private async append(type: string, payload: unknown): Promise<RelayEvent> {
    await this.ensureSeq();
    // No await between here and the increment, so concurrent appends cannot share a seq.
    const event: RelayEvent = { seq: ++this.seq!, type, payload, ts: Date.now() };

    const frame = JSON.stringify({ type: "event", event });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(frame);
      } catch (error) {
        console.error("[chat-relay] send failed", error);
      }
    }

    await this.sql`
      INSERT INTO chat_event (thread_id, seq, type, payload)
      VALUES (${this.threadId}, ${event.seq}, ${type}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (thread_id, seq) DO NOTHING
    `;
    return event;
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string) {
    ws.close(code, reason);
  }
}
