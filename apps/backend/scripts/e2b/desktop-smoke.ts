/**
 * E2B Desktop smoke test. TESTING ONLY: nothing in src/ imports this.
 *
 *   bun run e2b:smoke                 # ~3 min, ~$0.03: create, control, stream, pause/resume, kill
 *   bun run e2b:smoke -- --hold 120   # keep the desktop open 120s so you can watch the live view
 *
 * Needs E2B_API_KEY in apps/backend/.dev.vars (gitignored). The live-view URL
 * contains a password: treat it like one and do not paste it anywhere.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Sandbox } from "@e2b/desktop";

const holdSeconds = Number(process.argv[process.argv.indexOf("--hold") + 1]) || 0;
const outDir = mkdtempSync(join(tmpdir(), "k4-e2b-"));
const results: Array<{ step: string; ok: boolean; ms: number; note: string }> = [];

async function step<T>(name: string, fn: () => Promise<T>, note?: (v: T) => string) {
  const started = Date.now();
  try {
    const value = await fn();
    results.push({ step: name, ok: true, ms: Date.now() - started, note: note?.(value) ?? "" });
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0]! : String(error);
    results.push({ step: name, ok: false, ms: Date.now() - started, note: message.slice(0, 140) });
    return undefined;
  }
}

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
    () =>
      Sandbox.create({
        resolution: [1024, 768],
        timeoutMs: 5 * 60_000,
        network: { allowPublicTraffic: true },
      }),
    (s) => `id ${s.sandboxId}`,
  );
  if (!sandbox) throw new Error("could not create a sandbox, stopping");
  const sbx = sandbox;

  await step("sandbox size", () => sbx.getInfo(), (i) => `${i.cpuCount} vCPU, ${i.memoryMB} MiB, template ${i.name ?? i.templateId}`);

  await step("run a command", () => sbx.commands.run("uname -sr && . /etc/os-release && echo $PRETTY_NAME"), (r) => r.stdout.trim().replace(/\n/g, " | "));

  await step(
    "write and read a file",
    async () => {
      await sbx.files.write("/home/user/hello.txt", "hello from k4-bot");
      return sbx.files.read("/home/user/hello.txt");
    },
    (text) => JSON.stringify(text),
  );

  await step(
    "screenshot (empty desktop)",
    async () => {
      const png = await sbx.screenshot();
      writeFileSync(join(outDir, "1-desktop.png"), png);
      return png.byteLength;
    },
    (bytes) => `${bytes} bytes PNG`,
  );

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
      writeFileSync(join(outDir, "2-gedit.png"), png);
      if (!title.includes("gedit")) throw new Error(`focused window is "${title}", not gedit`);
      if (!title.startsWith("*")) throw new Error(`title "${title}" does not show unsaved text`);
      if (Buffer.compare(Buffer.from(png), Buffer.from(baseline)) === 0) throw new Error("screen did not change");
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
      await sbx.commands.run(
        "google-chrome --new-window --no-first-run --no-default-browser-check https://example.com",
        { background: true, timeoutMs: 0 },
      );
      await sbx.wait(7000);
      const title = await sbx.getWindowTitle(await sbx.getCurrentWindowId());
      writeFileSync(join(outDir, "3-chrome.png"), await sbx.screenshot());
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
      writeFileSync(join(outDir, "3b-chrome-keyboard.png"), after);
      if (Buffer.compare(Buffer.from(before), Buffer.from(after)) === 0) throw new Error("page did not change");
      return after.byteLength;
    },
    () => "address bar changed; see 3b-chrome-keyboard.png",
  );

  const watchUrl = await step(
    "start live stream (password protected)",
    async () => {
      await sbx.stream.start({ requireAuth: true });
      return sbx.stream.getUrl({ authKey: sbx.stream.getAuthKey() });
    },
    () => "URL printed below",
  );
  if (watchUrl) {
    await step(
      "live view page loads (HTTP 200, noVNC)",
      async () => {
        const res = await fetch(watchUrl);
        const html = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!/noVNC/i.test(html)) throw new Error("not the noVNC page");
        return res.status;
      },
      (status) => `HTTP ${status}`,
    );

    // Talk to the VNC server the way the noVNC page does (RFB over a websocket)
    // and read which security types it offers: 2 = password, 1 = none.
    await step(
      "stream demands the password (VNC auth enforced)",
      async () => {
        const ws = new WebSocket(`wss://${new URL(watchUrl).host}/websockify`, ["binary"]);
        ws.binaryType = "arraybuffer";
        const queue: Uint8Array[] = [];
        ws.addEventListener("message", (m) => queue.push(new Uint8Array(m.data as ArrayBuffer)));
        const next = async () => {
          for (let waited = 0; queue.length === 0; waited += 100) {
            if (waited > 15_000) throw new Error("no reply from the VNC server");
            await new Promise((r) => setTimeout(r, 100));
          }
          return queue.shift()!;
        };
        try {
          const hello = await next();
          const version = new TextDecoder().decode(hello);
          if (!version.startsWith("RFB")) throw new Error(`not a VNC server: ${JSON.stringify(version)}`);
          ws.send(hello);
          const security = await next();
          const types = Array.from(security.slice(1, 1 + security[0]!));
          if (!types.includes(2) || types.includes(1)) throw new Error(`security types ${JSON.stringify(types)}: no password required`);
          return `${version.trim()}, security types ${JSON.stringify(types)} (2 = password)`;
        } finally {
          ws.close();
        }
      },
      (v) => v,
    );

    console.log(`\nLIVE VIEW (open in a browser; contains a password): ${watchUrl}\n`);
    if (holdSeconds > 0) {
      console.log(`Holding the desktop open for ${holdSeconds}s so you can watch...`);
      await new Promise((r) => setTimeout(r, holdSeconds * 1000));
    }
  }

  // Pause keeps disk AND memory; connect() resumes it with the apps still open.
  const windowsOf = async (s: Sandbox) =>
    JSON.stringify({
      gedit: await s.getApplicationWindows("gedit"),
      chrome: await s.getApplicationWindows("google-chrome"),
    });
  const beforePause = await step("record open windows before pause", () => windowsOf(sbx), (w) => w);
  const frameBefore = await sbx.screenshot().catch(() => undefined);
  await step("pause (disk + memory)", () => sbx.pause(), (paused) => `paused=${paused}`);
  const resumed = await step("resume with connect()", () => Sandbox.connect(sbx.sandboxId, { timeoutMs: 3 * 60_000 }), (s) => `running again as ${s.sandboxId}`);
  if (resumed) {
    sandbox = resumed;
    await step(
      "same windows are still open after resume",
      async () => {
        const after = await windowsOf(resumed);
        if (after !== beforePause) throw new Error(`windows changed: ${beforePause} -> ${after}`);
        const png = await resumed.screenshot();
        writeFileSync(join(outDir, "4-after-resume.png"), png);
        const same = frameBefore ? Buffer.compare(Buffer.from(png), Buffer.from(frameBefore)) === 0 : false;
        return same ? "windows and screen identical" : "windows identical (screen differs only slightly, e.g. the clock)";
      },
      (v) => v,
    );
  }
} finally {
  if (sandbox) {
    await step("kill sandbox (stops billing)", () => sandbox!.kill(), (k) => `killed=${k}`);
  }
}

console.log("\nRESULT");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.step.padEnd(44)} ${String(r.ms).padStart(6)}ms  ${r.note}`);
}
console.log(`\nScreenshots saved in: ${outDir}`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
