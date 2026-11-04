import type { Sandbox } from "e2b";
import { cap, fail, type Result } from "./constants";
import { SandboxLifecycle } from "./lifecycle";
import { clampTimeout, replaceOnce, shellQuote } from "./policy";

/** What a bot does in its sandbox. Every call checks the owner, resumes a paused sandbox and counts as work. */
export class SandboxExec extends SandboxLifecycle {
  private async use<T>(userId: string, fn: (sbx: Sandbox) => Promise<T>): Promise<Result<T>> {
    if (!this.owns(userId)) return fail("this sandbox belongs to another user");
    const live = await this.live();
    if (!live.ok) return live;
    this.markWorking();
    try {
      return { ok: true, value: await fn(live.value) };
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  /** `notify`: false for the editor's own listings, which are not shown in its terminal. */
  exec(userId: string, command: string, cwd?: string, timeoutS?: number, notify = true) {
    return this.use(userId, async (sbx) => {
      const r = await sbx.commands.run(command, { cwd, timeoutMs: clampTimeout(timeoutS) * 1000 }).catch((e: unknown) => e as { stdout?: string; stderr?: string; exitCode?: number });
      const out = { stdout: cap(r.stdout ?? ""), stderr: cap(r.stderr ?? String(r)), exitCode: r.exitCode ?? 1 };
      if (notify) this.broadcast({ type: "exec", command, exitCode: out.exitCode, output: `${out.stdout}${out.stderr}`.slice(-4000), at: Date.now() });
      return out;
    });
  }

  /** The file with numbered lines, for the model to read (never written back). */
  read(userId: string, path: string, offset = 1, limit?: number) {
    return this.use(userId, async (sbx) => {
      const lines = (await sbx.files.read(path)).split("\n");
      const start = Math.max(0, offset - 1);
      const end = limit ? start + limit : lines.length;
      return cap(lines.slice(start, end).map((l, i) => `${start + i + 1}\t${l}`).join("\n"));
    });
  }

  /** The exact file content (the editor and edits use this). */
  readRaw(userId: string, path: string) {
    return this.use(userId, (sbx) => sbx.files.read(path));
  }

  /** `by`: who wrote it, so the editor can tell the agent's changes from its own. */
  write(userId: string, path: string, content: string, by: "bot" | "user" = "bot") {
    return this.use(userId, async (sbx) => {
      await sbx.files.write(path, content);
      this.broadcast({ type: "file.changed", path, by, at: Date.now() });
    });
  }

  /** Replaces one exact occurrence in the raw file; refuses missing or ambiguous text. */
  edit(userId: string, path: string, old: string, replacement: string) {
    return this.use(userId, async (sbx) => {
      const r = replaceOnce(await sbx.files.read(path), old, replacement);
      if (!r.ok) throw new Error(r.error);
      await sbx.files.write(path, r.content);
      this.broadcast({ type: "file.changed", path, by: "bot", at: Date.now() });
      return "edited";
    });
  }

  search(userId: string, pattern: string, path = ".") {
    return this.exec(userId, `rg -n --max-count 50 -- ${shellQuote(pattern)} ${shellQuote(path)} || true`);
  }

  list(userId: string, path = ".") {
    return this.exec(userId, `ls -la -- ${shellQuote(path)}`);
  }

  /** The public URL of a port the bot serves on (E2B's own host format). */
  preview(userId: string, port: number) {
    return this.use(userId, async (sbx) => `https://${sbx.getHost(port)}`);
  }
}
