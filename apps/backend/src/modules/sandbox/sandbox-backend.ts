import type { Env } from "../../config/env";
import type { BotSandbox } from "./index";

export type SandboxStub = DurableObjectStub<BotSandbox>;

/** The bot's sandbox object (typed RPC: stub.ensure(userId, …), stub.exec(userId, …), …). */
export const sandboxFor = (env: Env, botId: string): SandboxStub => env.BOT_SANDBOX.get(env.BOT_SANDBOX.idFromName(botId));
