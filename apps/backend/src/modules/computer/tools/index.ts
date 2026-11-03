import type { ComputerStub } from "../sandbox-backend";
import { askUser, waitFor } from "./pause";
import { createPowerTools } from "./power";
import { createScreenTool, type ScreenHolder } from "./screen";

export type { ScreenHolder } from "./screen";

/** The tools a bot gets with a computer: the screen, the two pauses (a question, a sleep), and power. */
export function createComputerTools(options: { computer: ComputerStub; botId: string; runId: string; screen: ScreenHolder }) {
  return [createScreenTool(options), askUser, waitFor, ...createPowerTools(options.computer, options.botId)];
}
