import type { WorkflowStep } from "cloudflare:workers";
import type { Db } from "../../../db";
import type { Env } from "../../../config/env";
import type { RunLog } from "./run-log";

/** What every block needs while it runs. */
export type NodeDeps = { env: Env; db: Db; log: RunLog; run: { id: string; userId: string } };

/** How one block ended. */
export type NodeResult =
  | { status: "cancelled" }
  | { status: "failed"; error: string }
  | { status: "succeeded"; output: unknown; ifResult?: boolean; passed?: boolean };

/** A write as its own durable step: it happens once, and is skipped when the run resumes past it. */
export function once(step: WorkflowStep, name: string, write: () => Promise<unknown>) {
  return step.do(name, async () => {
    await write();
    return true;
  });
}
