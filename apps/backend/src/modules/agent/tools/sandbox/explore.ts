import { tool } from "langchain";
import { z } from "zod";
import { asText, type SandboxToolOptions, stubOf } from "./helpers";

const out = (r: { stdout: string; stderr: string }) => r.stdout || r.stderr || "(no output)";

/** Finding things in the bot's own sandbox: search, list, and the preview URL of a server it runs. */
export function createSandboxExploreTools(o: SandboxToolOptions) {
  const search = tool(({ pattern, path }) => asText(stubOf(o).search(o.userId, pattern, path), out), {
    name: "sandbox_search",
    description: "Search file contents in your sandbox with ripgrep (regex). Returns file:line:text, at most 50 matches per file.",
    schema: z.object({ pattern: z.string().min(1).max(500), path: z.string().max(500).optional().describe("Folder or file (default the current folder).") }),
  });
  const list = tool(({ path }) => asText(stubOf(o).list(o.userId, path), out), {
    name: "sandbox_list",
    description: "List a folder in your sandbox (ls -la).",
    schema: z.object({ path: z.string().max(500).optional() }),
  });
  const preview = tool(({ port }) => asText(stubOf(o).preview(o.userId, port), (url) => `Preview URL: ${url} (give it to the user; it works while the server runs).`), {
    name: "sandbox_preview",
    description: "The public URL of a web server you started in the sandbox on this port, so the user can open the app.",
    schema: z.object({ port: z.number().int().min(1).max(65535) }),
  });
  const stop = tool(() => asText(stubOf(o).pause(o.userId), () => "Sandbox paused. Its files are kept; sandbox_start resumes it."), {
    name: "sandbox_stop",
    description: "Pause your sandbox when you are done (files are kept, billing stops). It also pauses by itself when idle.",
    schema: z.object({}),
  });
  return [search, list, preview, stop];
}
