import type { AccountOptions } from "../../agent/account-tools";
import type { ComputerStub } from "../sandbox-backend";
import { createAppLoginTool } from "./app-login";
import { askUser, waitFor } from "./pause";
import { createPowerTools } from "./power";
import { createScreenTool, type ScreenHolder } from "./screen";

export type { ScreenHolder } from "./screen";

/** The tools a bot gets with a computer: the screen, app logins, the two pauses (a question, a sleep), and power. */
export function createComputerTools(options: { computer: ComputerStub; botId: string; runId: string; screen: ScreenHolder; account?: AccountOptions }) {
  const { account } = options;
  const appLogin = account && account.apps.length > 0 ? [createAppLoginTool({ ...options, account })] : [];
  return [createScreenTool(options), ...appLogin, askUser, waitFor, ...createPowerTools(options.computer, options.botId)];
}
