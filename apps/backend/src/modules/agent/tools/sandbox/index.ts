import { createSandboxExec } from "./exec";
import { createSandboxExploreTools } from "./explore";
import { createSandboxFileTools } from "./files";
import type { SandboxToolOptions } from "./helpers";
import { createSandboxManageTools } from "./manage";
import { createSandboxStart } from "./start";

export type { SandboxToolOptions } from "./helpers";

/** The coding bot's sandbox tools (one sandbox per bot, enforced by the Durable Object and the table's key). */
export function createSandboxTools(o: SandboxToolOptions) {
  return [createSandboxStart(o), createSandboxExec(o), ...createSandboxFileTools(o), ...createSandboxExploreTools(o), ...createSandboxManageTools(o)];
}
