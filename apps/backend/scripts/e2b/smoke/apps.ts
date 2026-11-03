import { writeFileSync } from "node:fs";
import type { Sandbox } from "@e2b/desktop";
import { sameImage, shot, step } from "./step";

/** Desktop apps, typing, clicking and Chrome: every step checks the effect, not the absence of an error. */
export async function checkApps(sbx: Sandbox) {
  // launch() runs `gtk-launch <desktop-id>` in the background and NEVER reports
  // failure: `launch("gedit")` "succeeds" while nothing opens (the id is
  // org.gnome.gedit). So every step below checks the effect, not the absence of
  // an error, and the agent tools must do the same.
  const baseline = await sbx.screenshot();
  await step(
    "launch gedit and find its window",
    async () => {
      await sbx.launch("org.gnome.gedit");
      await sbx.wait(5000);
      const windows = await sbx.getApplicationWindows("gedit");
      if (windows.length === 0) throw new Error("no gedit window appeared");
      return windows;
    },
    (w) => `${w.length} window(s)`,
  );

  await step(
    "type text and see it on screen",
    async () => {
      await sbx.write("Hello from the K4 Bot agent!");
      await sbx.wait(800);
      const title = await sbx.getWindowTitle(await sbx.getCurrentWindowId());
      const png = await sbx.screenshot();
      writeFileSync(shot("2-gedit.png"), png);
      if (!title.includes("gedit")) throw new Error(`focused window is "${title}", not gedit`);
      if (!title.startsWith("*")) throw new Error(`title "${title}" does not show unsaved text`);
      if (sameImage(png, baseline)) throw new Error("screen did not change");
      return title;
    },
    (t) => `"${t}"`,
  );

  // SDK quirk: moveMouse()/leftClick(x, y) use `xdotool mousemove --sync`, which
  // waits ~15s when the pointer is ALREADY at (x, y). `mousemove X Y click 1`
  // does the same job in ~0.4s, so the agent's click tool must use that.
  await step(
    "click twice on the same spot (must be fast)",
    async () => {
      const started = Date.now();
      await sbx.commands.run("xdotool mousemove 300 300 click 1");
      await sbx.commands.run("xdotool mousemove 300 300 click 1");
      const ms = Date.now() - started;
      if (ms > 4000) throw new Error(`two clicks took ${ms}ms`);
      return ms;
    },
    (ms) => `${ms}ms for 2 clicks`,
  );

  // launch(app, url) ignores the URL, and open(url) uses the system default
  // browser (Firefox). Starting Chrome as a command is the reliable way.
  await step(
    "start Chrome on a URL and read the page title",
    async () => {
      await sbx.commands.run("google-chrome --new-window --no-first-run --no-default-browser-check https://example.com", { background: true, timeoutMs: 0 });
      await sbx.wait(7000);
      const title = await sbx.getWindowTitle(await sbx.getCurrentWindowId());
      writeFileSync(shot("3-chrome.png"), await sbx.screenshot());
      if (!title.includes("Example Domain")) throw new Error(`unexpected page: "${title}"`);
      return title;
    },
    (t) => `"${t}"`,
  );

  await step(
    "navigate Chrome with the keyboard (Ctrl+L, type, Enter)",
    async () => {
      const before = await sbx.screenshot();
      await sbx.press(["ctrl", "l"]);
      await sbx.write("https://example.org");
      await sbx.press("enter");
      await sbx.wait(4000);
      const after = await sbx.screenshot();
      writeFileSync(shot("3b-chrome-keyboard.png"), after);
      if (sameImage(before, after)) throw new Error("page did not change");
      return after.byteLength;
    },
    () => "address bar changed; see 3b-chrome-keyboard.png",
  );
}
