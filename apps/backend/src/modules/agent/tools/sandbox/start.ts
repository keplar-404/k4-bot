import { tool } from "langchain";
import { z } from "zod";
import { asText, type SandboxToolOptions, stubOf } from "./helpers";

/** One sandbox per bot: an existing one is resumed, never duplicated. */
export const createSandboxStart = (o: SandboxToolOptions) =>
  tool(
    ({ purpose }) =>
      asText(stubOf(o).ensure(o.userId, purpose), (v) =>
        v.created ? `Sandbox created (id ${v.sandboxId}). Work in /home/user.` : `Your sandbox is running again (id ${v.sandboxId}); its files are as you left them.`,
      ),
    {
      name: "sandbox_start",
      description:
        "Start (or resume) YOUR code sandbox: a Linux machine with a shell, for writing and running code. You have at most one; calling this again resumes it. " +
        "Call it before any other sandbox_* tool.",
      schema: z.object({ purpose: z.string().min(3).max(300).describe("What the sandbox is for, shown to the user (e.g. 'Express API for the todo app').") }),
    },
  );
