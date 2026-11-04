import { NotFoundError, Sandbox } from "@e2b/desktop";
import type { Env } from "../../../config/env";
import { DENY_OUT, parseAllowedHosts } from "../guards";
import { SCREEN } from "../types";
import { SESSION_MS } from "./constants";

/**
 * Run as root once per computer, before any bot uses it. Bots are ordinary Linux users with no sudo
 * rights; this closes what is left:
 *  - the desktop's own account (/home/user) is not readable by bots;
 *  - bots cannot see other users' processes or their command lines (hidepid);
 *  - root has no usable password, so `su` cannot become root.
 * Every step is idempotent and best effort: a template without one of these just skips it.
 */
export const HARDEN = ["chmod 750 /home/user", "mount -o remount,hidepid=2 /proc", "passwd -l root"].map((c) => `${c} >/dev/null 2>&1`).join("; ") + "; true";

/** connect() resumes a paused sandbox with its memory (open windows, running apps) intact. Undefined when it is gone. */
export async function connectSandbox(id: string, apiKey: string | undefined): Promise<Sandbox | undefined> {
  try {
    return await Sandbox.connect(id, { apiKey, timeoutMs: SESSION_MS });
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
    return undefined;
  }
}

/** The user's computer if one exists that this object has no id for (newest kept, any other killed). */
export async function findOwnSandbox(apiKey: string | undefined, userId: string | undefined): Promise<Sandbox | undefined> {
  if (!userId) return undefined;
  const found = await Sandbox.list({ apiKey, query: { metadata: { app: "k4-bot", userId } } })
    .nextItems()
    .catch(() => []);
  const [keep, ...extra] = found.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  for (const s of extra) await Sandbox.kill(s.sandboxId, { apiKey }).catch(() => undefined);
  if (!keep) return undefined;
  console.log(`[computer] adopted ${keep.sandboxId}${extra.length ? `, killed ${extra.length} extra` : ""}`);
  return Sandbox.connect(keep.sandboxId, { apiKey, timeoutMs: SESSION_MS });
}

/** Kills every computer of this user (a reset must not leave one behind for `findOwnSandbox` to adopt). */
export async function killOwnSandboxes(apiKey: string | undefined, userId: string | undefined): Promise<void> {
  if (!userId) return;
  const found = await Sandbox.list({ apiKey, query: { metadata: { app: "k4-bot", userId } } })
    .nextItems()
    .catch(() => []);
  await Promise.allSettled(found.map((s) => Sandbox.kill(s.sandboxId, { apiKey })));
}

/** A brand new desktop for the user. */
export async function createSandbox(cfg: Env, userId: string | undefined): Promise<Sandbox> {
  const allowed = parseAllowedHosts(cfg.COMPUTER_ALLOWED_HOSTS);
  const network = {
    // Private to everyone but this Durable Object: reached only through our authenticated proxy.
    allowPublicTraffic: false,
    ...(allowed.length > 0 ? { allowOut: allowed.flatMap((h) => [h, `*.${h}`]), denyOut: ["0.0.0.0/0"] } : { denyOut: DENY_OUT }),
  };
  const options = {
    apiKey: cfg.E2B_API_KEY,
    resolution: [SCREEN.width, SCREEN.height] as [number, number],
    dpi: 96,
    timeoutMs: SESSION_MS,
    // On timeout E2B pauses (memory kept, billing stops) instead of destroying the work.
    lifecycle: { onTimeout: "pause" as const, autoResume: false },
    network,
    // Lets an operator tell whose computer a sandbox is in the E2B console.
    metadata: { app: "k4-bot", userId: userId ?? "unknown" },
  };
  return cfg.E2B_TEMPLATE === "desktop" ? Sandbox.create(options) : Sandbox.create(cfg.E2B_TEMPLATE, options);
}
