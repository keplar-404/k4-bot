import type { Sandbox } from "e2b";
import { cap } from "../../../src/modules/sandbox/constants";
import { clampTimeout, replaceOnce, shellQuote } from "../../../src/modules/sandbox/policy";

/**
 * The BotSandbox Durable Object's RPC surface, served straight from one E2B sandbox, so the eval runs the bot's real
 * sandbox tools (same schemas, prompts and middleware) outside the Workers runtime. Same rules as the Durable Object:
 * exact-once edits, quoted arguments, clamped timeouts, capped output.
 */
export function directSandbox(sbx: Sandbox) {
  const ok = <T>(value: T) => ({ ok: true as const, value });
  const guard = async <T>(fn: () => Promise<T>) => {
    try {
      return ok(await fn());
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  };
  const exec = (_u: string, command: string, cwd?: string, timeoutS?: number) =>
    guard(async () => {
      const r = await sbx.commands.run(command, { cwd, timeoutMs: clampTimeout(timeoutS) * 1000 }).catch((e: unknown) => e as { stdout?: string; stderr?: string; exitCode?: number });
      return { stdout: cap(r.stdout ?? ""), stderr: cap(r.stderr ?? String(r)), exitCode: r.exitCode ?? 1 };
    });
  return {
    ensure: async () => ok({ sandboxId: sbx.sandboxId, created: false }),
    exec,
    read: (_u: string, path: string, offset = 1, limit?: number) =>
      guard(async () => {
        const lines = (await sbx.files.read(path)).split("\n");
        const start = Math.max(0, offset - 1);
        return cap(lines.slice(start, limit ? start + limit : undefined).map((l, i) => `${start + i + 1}\t${l}`).join("\n"));
      }),
    write: (_u: string, path: string, content: string) => guard(async () => void (await sbx.files.write(path, content))),
    edit: (_u: string, path: string, old: string, replacement: string) =>
      guard(async () => {
        const r = replaceOnce(await sbx.files.read(path), old, replacement);
        if (!r.ok) throw new Error(r.error);
        await sbx.files.write(path, r.content);
        return "edited";
      }),
    search: (u: string, pattern: string, path = ".") => exec(u, `rg -n --max-count 50 -- ${shellQuote(pattern)} ${shellQuote(path)} || grep -rn -- ${shellQuote(pattern)} ${shellQuote(path)} || true`),
    list: (u: string, path = ".") => exec(u, `ls -la -- ${shellQuote(path)}`),
    preview: async (_u: string, port: number) => ok(`https://${sbx.getHost(port)}`),
    pause: async () => ok(null),
    destroy: async () => ok(null),
  };
}

/** An `env` whose BOT_SANDBOX binding hands every bot this one sandbox (what the tools look up). */
export const envWith = (sandbox: ReturnType<typeof directSandbox>, base: object) =>
  ({ ...base, BOT_SANDBOX: { idFromName: (n: string) => n, get: () => sandbox } }) as never;
