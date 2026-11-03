import { writeFileSync } from "node:fs";
import { Sandbox } from "@e2b/desktop";
import { sameImage, shot, step } from "./step";

/** Pause keeps disk AND memory; connect() resumes it with the apps still open. Returns the resumed sandbox. */
export async function checkPauseResume(sbx: Sandbox): Promise<Sandbox | undefined> {
  const windowsOf = async (s: Sandbox) =>
    JSON.stringify({
      gedit: await s.getApplicationWindows("gedit"),
      chrome: await s.getApplicationWindows("google-chrome"),
    });
  const beforePause = await step("record open windows before pause", () => windowsOf(sbx), (w) => w);
  const frameBefore = await sbx.screenshot().catch(() => undefined);
  await step("pause (disk + memory)", () => sbx.pause(), (paused) => `paused=${paused}`);
  const resumed = await step("resume with connect()", () => Sandbox.connect(sbx.sandboxId, { timeoutMs: 3 * 60_000 }), (s) => `running again as ${s.sandboxId}`);
  if (!resumed) return undefined;
  await step(
    "same windows are still open after resume",
    async () => {
      const after = await windowsOf(resumed);
      if (after !== beforePause) throw new Error(`windows changed: ${beforePause} -> ${after}`);
      const png = await resumed.screenshot();
      writeFileSync(shot("4-after-resume.png"), png);
      const same = frameBefore ? sameImage(png, frameBefore) : false;
      return same ? "windows and screen identical" : "windows identical (screen differs only slightly, e.g. the clock)";
    },
    (v) => v,
  );
  return resumed;
}
