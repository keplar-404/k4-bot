import type { Env } from "../../config/env";
import type { AsyncTaskRegistry } from "./registry";

/** The thread's background-task registry (typed RPC). */
export const registryFor = (env: Env, threadId: string): DurableObjectStub<AsyncTaskRegistry> => env.ASYNC_TASKS.get(env.ASYNC_TASKS.idFromName(threadId));
