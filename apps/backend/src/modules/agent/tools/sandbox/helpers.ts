import type { Env } from "../../../../config/env";
import type { Db } from "../../../../db";
import type { Result } from "../../../sandbox/constants";
import { sandboxFor, type SandboxStub } from "../../../sandbox/sandbox-backend";

/** Who calls: the run's user and bot. A tool never takes a bot id from the model for its own sandbox. */
export type SandboxToolOptions = { env: Env; db: Db; userId: string; botId: string };

export const stubOf = (o: SandboxToolOptions): SandboxStub => sandboxFor(o.env, o.botId);

/** A sandbox result as tool text: the value, or `NOT DONE: <reason>` the bot can repeat to the user. */
export async function asText<T>(call: Promise<Result<T>>, format: (value: T) => string): Promise<string> {
  try {
    const r = await call;
    return r.ok ? format(r.value) : `NOT DONE: ${r.error}.`;
  } catch (error) {
    return `NOT DONE: the sandbox did not answer (${error instanceof Error ? error.message : String(error)}).`;
  }
}
