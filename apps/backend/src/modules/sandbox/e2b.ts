import { NotFoundError, Sandbox } from "e2b";
import type { Env } from "../../config/env";
import { DENY_OUT } from "../computer/guards";

/** E2B's own timeout: kept ahead of activity by the Durable Object; on expiry E2B pauses (never kills) the sandbox. */
export const SANDBOX_TIMEOUT_MS = 15 * 60_000;

/**
 * A new code sandbox for one bot. Public traffic stays on so the user's browser can open the preview URL of a
 * server the bot starts; outbound traffic to private networks and cloud metadata is denied, like the computer.
 * Metadata lets an operator tell whose sandbox it is in the E2B console.
 */
export function createCodingSandbox(cfg: Env, ids: { userId: string; botId: string }): Promise<Sandbox> {
  return Sandbox.create(cfg.SANDBOX_TEMPLATE, {
    apiKey: cfg.E2B_API_KEY,
    timeoutMs: SANDBOX_TIMEOUT_MS,
    lifecycle: { onTimeout: "pause", autoResume: false },
    network: { denyOut: DENY_OUT },
    metadata: { app: "k4-bot", kind: "coding", userId: ids.userId, botId: ids.botId },
  });
}

/** Resumes a paused sandbox (files and memory intact). Undefined when E2B no longer has it. */
export async function connectCoding(id: string, apiKey: string | undefined): Promise<Sandbox | undefined> {
  try {
    return await Sandbox.connect(id, { apiKey, timeoutMs: SANDBOX_TIMEOUT_MS });
  } catch (error) {
    if (error instanceof NotFoundError) return undefined;
    throw error;
  }
}

export const pauseCoding = (id: string, apiKey: string | undefined) => Sandbox.pause(id, { apiKey });

/** Deletes the sandbox and everything in it. Already gone counts as done. */
export const killCoding = (id: string, apiKey: string | undefined) => Sandbox.kill(id, { apiKey }).catch(() => undefined);
