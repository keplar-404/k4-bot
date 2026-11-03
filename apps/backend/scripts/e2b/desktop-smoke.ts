/**
 * E2B Desktop smoke test. TESTING ONLY: nothing in src/ imports this.
 *
 *   bun run e2b:smoke                 # ~3 min, ~$0.03: create, control, stream, pause/resume, kill
 *   bun run e2b:smoke -- --hold 120   # keep the desktop open 120s so you can watch the live view
 *
 * Needs E2B_API_KEY in apps/backend/.dev.vars (gitignored). The live-view URL
 * contains a password: treat it like one and do not paste it anywhere.
 */
import { Sandbox } from "@e2b/desktop";
import { checkApps } from "./smoke/apps";
import { checkBasics } from "./smoke/basics";
import { checkPauseResume } from "./smoke/resume";
import { report, step } from "./smoke/step";
import { checkStream } from "./smoke/stream";

const holdSeconds = Number(process.argv[process.argv.indexOf("--hold") + 1]) || 0;

if (!process.env.E2B_API_KEY) {
  console.error("E2B_API_KEY is not set. Add it to apps/backend/.dev.vars and run: bun run e2b:smoke");
  process.exit(1);
}

let sandbox: Sandbox | undefined;
try {
  // Public traffic + a stream password is the only way a plain browser tab can
  // open the live view. The sandbox lives at most 5 minutes and is killed below.
  sandbox = await step(
    "create desktop sandbox",
    () => Sandbox.create({ resolution: [1024, 768], timeoutMs: 5 * 60_000, network: { allowPublicTraffic: true } }),
    (s) => `id ${s.sandboxId}`,
  );
  if (!sandbox) throw new Error("could not create a sandbox, stopping");
  const sbx = sandbox;
  await checkBasics(sbx);
  await checkApps(sbx);
  await checkStream(sbx, holdSeconds);
  sandbox = (await checkPauseResume(sbx)) ?? sandbox;
} finally {
  if (sandbox) {
    await step("kill sandbox (stops billing)", () => sandbox!.kill(), (k) => `killed=${k}`);
  }
}

report();
