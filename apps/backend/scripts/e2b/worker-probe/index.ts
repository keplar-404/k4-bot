/**
 * Probe: does the E2B Desktop SDK work inside a Cloudflare Worker, where the
 * real agent runs? TESTING ONLY. GET / creates a desktop, runs one command,
 * takes one screenshot, then kills the sandbox.
 */
import { Sandbox } from "@e2b/desktop";

interface Env {
  E2B_API_KEY: string;
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const started = Date.now();
    const sandbox = await Sandbox.create({
      apiKey: env.E2B_API_KEY,
      resolution: [800, 600],
      timeoutMs: 2 * 60_000,
    });
    try {
      const uname = (await sandbox.commands.run("uname -sr")).stdout.trim();
      const png = await sandbox.screenshot();
      return Response.json({
        ok: true,
        sandboxId: sandbox.sandboxId,
        uname,
        screenshotBytes: png.byteLength,
        ms: Date.now() - started,
      });
    } catch (error) {
      return Response.json({ ok: false, error: String(error) }, { status: 500 });
    } finally {
      await sandbox.kill();
    }
  },
};
