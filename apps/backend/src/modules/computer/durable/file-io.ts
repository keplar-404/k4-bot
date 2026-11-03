import { CommandExitError, type Sandbox } from "@e2b/desktop";
import { shellQuote } from "../guards";
import { STAGE_DIR } from "./constants";
import { runAs } from "./accounts";

/*
 * Bot file I/O never uses E2B's files API: it acts with root's rights (verified: as one bot it reads
 * another bot's 700 browser profile and writes into its home, also through a symlink planted in the
 * bot's own folder), so path checks in this code could be bypassed. Reads and writes instead run as
 * the bot's own Linux user, and the kernel decides, symlinks included.
 */

function fileError(error: unknown): "file_not_found" | "is_directory" | "permission_denied" {
  const text = error instanceof CommandExitError ? error.stderr : String(error);
  if (/No such file/i.test(text)) return "file_not_found";
  if (/Is a directory/i.test(text)) return "is_directory";
  return "permission_denied";
}

export async function uploadAs(sbx: Sandbox, user: string, files: Array<[string, Uint8Array]>): Promise<Array<{ path: string; error: string | null }>> {
  const out: Array<{ path: string; error: string | null }> = [];
  for (const [path, data] of files) {
    // The bytes go to a root-only staging file readable by this bot's group alone, then the bot itself
    // copies them into place (creating parent folders), so it can only write where Linux lets it.
    const stage = `${STAGE_DIR}/${crypto.randomUUID()}`;
    try {
      await sbx.files.write(stage, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, { user: "root" });
      await sbx.commands.run(
        `chown root:${user} ${stage} && chmod 640 ${stage} && ` +
          `runuser -u ${user} -- sh -c 'umask 022; mkdir -p -- "$(dirname -- "$1")" && cat -- "$2" > "$1"' _ ${shellQuote(path)} ${stage}; ` +
          `rc=$?; rm -f ${stage}; exit $rc`,
        { user: "root", timeoutMs: 60_000 },
      );
      out.push({ path, error: null });
    } catch (error) {
      await sbx.commands.run(`rm -f ${stage}`, { user: "root" }).catch(() => undefined);
      out.push({ path, error: fileError(error) });
    }
  }
  return out;
}

/** Reads as the bot's own user: other bots' shared files yes, their private browser profile no. */
export async function downloadAs(sbx: Sandbox, user: string, paths: string[]): Promise<Array<{ path: string; content: Uint8Array | null; error: string | null }>> {
  const out: Array<{ path: string; content: Uint8Array | null; error: string | null }> = [];
  for (const path of paths) {
    try {
      // runAs: a bot's command must start in its own home (the default directory is not its to enter).
      const r = await runAs(sbx, user, `base64 -w0 -- ${shellQuote(path)}`, 60_000);
      out.push({ path, content: new Uint8Array(Buffer.from(r.stdout, "base64")), error: null });
    } catch (error) {
      out.push({ path, content: null, error: fileError(error) });
    }
  }
  return out;
}
