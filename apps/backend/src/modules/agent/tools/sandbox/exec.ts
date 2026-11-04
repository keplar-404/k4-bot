import { tool } from "langchain";
import { z } from "zod";
import { asText, type SandboxToolOptions, stubOf } from "./helpers";

export const createSandboxExec = (o: SandboxToolOptions) =>
  tool(
    ({ command, cwd, timeout_s }) =>
      asText(stubOf(o).exec(o.userId, command, cwd, timeout_s), (r) => `exit ${r.exitCode}\n--- stdout ---\n${r.stdout}\n--- stderr ---\n${r.stderr}`),
    {
      name: "sandbox_exec",
      description:
        "Run a shell command in your sandbox (bash, as an unprivileged user; no sudo). Use it to install packages, run tests, build and start servers. " +
        "Long-running servers: start them in the background (`nohup … &`) and check with curl. Output is capped at 30,000 characters.",
      schema: z.object({
        command: z.string().min(1).max(10_000).describe("The command line."),
        cwd: z.string().max(500).optional().describe("Working directory (default /home/user)."),
        timeout_s: z.number().int().min(1).max(600).optional().describe("Seconds before it is stopped (default 120, max 600)."),
      }),
    },
  );
