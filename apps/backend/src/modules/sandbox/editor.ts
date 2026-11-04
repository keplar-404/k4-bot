import { fail, type Result } from "./constants";
import { SandboxExec } from "./exec";
import { HOME, hashOf, homePath, parseTree, SKIP_DIRS } from "./paths";
import { shellQuote } from "./policy";

/** At most this many tree entries per listing (a huge project is listed folder by folder). */
const MAX_ENTRIES = 2000;

/**
 * What the code editor page needs: the file tree, a file with its version (hash), and saving with a conflict check.
 * Edits from the page are broadcast like the bot's, so a second open editor sees them too.
 */
export class SandboxEditor extends SandboxExec {
  async tree(userId: string, path = HOME): Promise<Result<Array<{ path: string; dir: boolean }>>> {
    const root = homePath(path);
    if (!root) return fail("that folder is outside the sandbox home");
    // Quoted parentheses need no backslashes; %y prints "d" or "f" (other types are dropped by parseTree).
    const prune = SKIP_DIRS.map((d) => `-name ${shellQuote(d)}`).join(" -o ");
    const cmd = `find ${shellQuote(root)} -maxdepth 6 -type d '(' ${prune} ')' -prune -o -printf '%y %p\\n' 2>/dev/null | head -n ${MAX_ENTRIES}`;
    const r = await this.exec(userId, cmd, undefined, 30, false);
    return r.ok ? { ok: true, value: parseTree(r.value.stdout) } : r;
  }

  async openFile(userId: string, path: string): Promise<Result<{ path: string; content: string; hash: string }>> {
    const abs = homePath(path);
    if (!abs) return fail("that file is outside the sandbox home");
    const r = await this.readRaw(userId, abs);
    return r.ok ? { ok: true, value: { path: abs, content: r.value, hash: await hashOf(r.value) } } : r;
  }

  /** Saves only when the file is still the version the editor loaded (`baseHash`); otherwise `conflict`. */
  async saveFile(userId: string, path: string, content: string, baseHash: string | null): Promise<Result<{ hash: string } | { conflict: true; hash: string }>> {
    const abs = homePath(path);
    if (!abs) return fail("that file is outside the sandbox home");
    if (baseHash !== null) {
      const now = await this.readRaw(userId, abs);
      if (now.ok && (await hashOf(now.value)) !== baseHash) return { ok: true, value: { conflict: true, hash: await hashOf(now.value) } };
    }
    const w = await this.write(userId, abs, content, "user");
    return w.ok ? { ok: true, value: { hash: await hashOf(content) } } : w;
  }

  /** The editor's live socket (the Worker route verified the token and passes the user). Open sockets keep it awake. */
  override async fetch(request: Request): Promise<Response> {
    const userId = request.headers.get("x-sandbox-user") ?? "";
    if (new URL(request.url).pathname !== "/ws" || request.headers.get("Upgrade") !== "websocket") return new Response("Not found", { status: 404 });
    if (!userId || !this.owns(userId)) return new Response("Forbidden", { status: 403 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    this.markWorking();
    pair[1].send(JSON.stringify({ type: "status", state: this.state }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string) {
    // The idle clock starts when the last editor closes.
    this.lastActivity = Date.now();
    ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
  }
}
