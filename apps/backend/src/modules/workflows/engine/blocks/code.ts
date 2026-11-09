import { CommandExitError, Sandbox, TimeoutError } from "e2b";
import type { Env } from "../../../../config/env";
import type { Db } from "../../../../db";
import { sandboxUsage } from "../../../../db/schema";
import { DENY_OUT } from "../../../computer/guards";
import { dayOf } from "../../../sandbox/policy";
import { secondsToday } from "../../../sandbox/store";
import { CODE_LIMITS, type CodeConfig } from "../../graph/code-block";
import { FatalBlockError } from "../errors";

const DIR = "/home/user/k4";
/** Runs the user's code as the body of an async function of `input`, and saves what it returns as JSON. */
const RUNNER = `import { readFile, writeFile } from "node:fs/promises";
const input = JSON.parse(await readFile("${DIR}/in.json", "utf8"));
const body = await readFile("${DIR}/code.js", "utf8");
const AsyncFunction = (async () => {}).constructor;
const result = await new AsyncFunction("input", body)(input);
await writeFile("${DIR}/out.json", JSON.stringify(result === undefined ? null : result));
`;
const tail = (text: string, max = 4000) => (text.length > max ? `…${text.slice(-max)}` : text);

/**
 * The Code block: a fresh sandbox per run, killed afterwards. Refused when today's sandbox minutes are used up; the
 * seconds it was alive are recorded (rounded up). Errors in the code are the user's: they fail at once, no retry.
 */
export async function runCode(env: Env, db: Db, run: { id: string; userId: string }, config: CodeConfig, input: Record<string, unknown>) {
  if (!env.E2B_API_KEY) throw new FatalBlockError("Code blocks are not set up on this server (E2B_API_KEY).");
  const inputJson = JSON.stringify(input);
  if (inputJson.length > CODE_LIMITS.inputBytes) throw new FatalBlockError("The input is too large (256 KB at most).");
  const left = env.SANDBOX_MAX_MINUTES_PER_DAY * 60 - (await secondsToday(db, run.userId));
  if (left < config.timeoutSeconds) {
    throw new FatalBlockError(`Not enough sandbox time left today (${Math.max(0, Math.floor(left))} s) for a ${config.timeoutSeconds} s run. It resets at 00:00 UTC.`);
  }

  const started = Date.now();
  const sbx = await Sandbox.create(env.SANDBOX_TEMPLATE, {
    apiKey: env.E2B_API_KEY,
    timeoutMs: (config.timeoutSeconds + 60) * 1000,
    network: { denyOut: DENY_OUT },
    metadata: { app: "k4-bot", kind: "workflow-code", userId: run.userId, runId: run.id },
  });
  try {
    await sbx.files.write([
      { path: `${DIR}/in.json`, data: inputJson },
      { path: `${DIR}/code.js`, data: config.code },
      { path: `${DIR}/runner.mjs`, data: RUNNER },
    ]);
    const done = await sbx.commands.run(`node ${DIR}/runner.mjs`, { timeoutMs: config.timeoutSeconds * 1000 });
    const out = await sbx.files.read(`${DIR}/out.json`);
    if (out.length > CODE_LIMITS.outputBytes) throw new FatalBlockError("The result is too large (64 KB at most).");
    return { result: JSON.parse(out) as unknown, logs: tail(done.stdout), seconds: Math.ceil((Date.now() - started) / 1000) };
  } catch (error) {
    if (error instanceof CommandExitError) throw new FatalBlockError(`The code failed: ${tail(error.stderr || error.stdout, 1500).trim()}`);
    if (error instanceof TimeoutError) throw new FatalBlockError(`The code took longer than ${config.timeoutSeconds} s and was stopped.`);
    throw error;
  } finally {
    await sbx.kill().catch(() => undefined);
    const seconds = Math.ceil((Date.now() - started) / 1000);
    await db
      .insert(sandboxUsage)
      .values({ id: crypto.randomUUID(), userId: run.userId, day: dayOf(started), seconds, source: `workflow:${run.id}` })
      .catch((e: unknown) => console.error("[workflow-code] usage not recorded", e));
  }
}
