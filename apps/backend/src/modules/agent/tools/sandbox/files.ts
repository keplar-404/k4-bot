import { tool } from "langchain";
import { z } from "zod";
import { asText, type SandboxToolOptions, stubOf } from "./helpers";

const path = z.string().min(1).max(500).describe("File path in the sandbox (absolute, or relative to /home/user).");

/** Reading, writing and exact-replace editing of files in the bot's own sandbox. */
export function createSandboxFileTools(o: SandboxToolOptions) {
  const read = tool(({ path, offset, limit }) => asText(stubOf(o).read(o.userId, path, offset, limit), (t) => t || "(empty file)"), {
    name: "sandbox_read",
    description: "Read a file from your sandbox with line numbers (the numbers are not part of the file). Read before you edit.",
    schema: z.object({ path, offset: z.number().int().min(1).optional().describe("First line (default 1)."), limit: z.number().int().min(1).max(5000).optional() }),
  });
  const write = tool(({ path, content }) => asText(stubOf(o).write(o.userId, path, content), () => `Wrote ${path}.`), {
    name: "sandbox_write",
    description: "Create or overwrite a whole file in your sandbox. For changes to an existing file prefer sandbox_edit.",
    schema: z.object({ path, content: z.string().max(500_000) }),
  });
  const edit = tool(({ path, old, new: replacement }) => asText(stubOf(o).edit(o.userId, path, old, replacement), () => `Edited ${path}.`), {
    name: "sandbox_edit",
    description: "Replace one exact piece of text in a file. `old` must appear exactly once (copy it from sandbox_read without the line numbers; include surrounding lines to make it unique).",
    schema: z.object({ path, old: z.string().min(1), new: z.string() }),
  });
  return [read, write, edit];
}
