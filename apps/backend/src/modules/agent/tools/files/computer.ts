import { eq } from "drizzle-orm";
import { tool } from "langchain";
import { z } from "zod";
import { shellQuote } from "../../../computer/guards";
import { chatFile } from "../../../../db/schema";
import { formatBytes, loadFile, MAX_FILE_BYTES, saveFile } from "../../../files";
import { fileMarker } from "../../parts";
import { describeFile, type FileToolsOptions } from "./options";

/** Moving files between the chat and the computer. Only for runs that may use the computer. */
export function createComputerFileTools(o: FileToolsOptions, computer: NonNullable<FileToolsOptions["computer"]>) {
  const copyToComputer = tool(
    async ({ file_id, path }) => {
      const file = await loadFile(o.bucket, o.db, o.userId, file_id);
      if (!file) return "NOT DONE: no such file.";
      const target = !path ? `${computer.home}/files/${file.row.name}` : path.startsWith("/") ? path : `${computer.home}/${path.replace(/^~\/?/, "")}`;
      const [result] = await computer.stub.upload(o.botId, [[target, file.bytes]]);
      if (result?.error) {
        return result.error === "permission_denied"
          ? `NOT DONE: you can only write inside your own folder ${computer.home}.`
          : `NOT DONE: could not write ${target} (${result.error}).`;
      }
      await o.db.update(chatFile).set({ computerPath: target }).where(eq(chatFile.id, file.row.id));
      return `Copied "${file.row.name}" to ${target} on the computer (any older file there was replaced). This gives the user NO download link: if they asked for one, call share_file with path "${target}" now.`;
    },
    {
      name: "copy_to_computer",
      description:
        "Put a stored file (one the user attached or you created) on the computer, inside your own folder. " +
        "Default location: your folder's files/ subfolder. Use it before working on an attached file with the shell or apps. It does not create a download link: use share_file for that.",
      schema: z.object({
        file_id: z.string().describe("The file id."),
        path: z.string().max(500).optional().describe(`Absolute path inside ${computer.home}, or relative to it. Default: files/<name>.`),
      }),
    },
  );

  const shareFile = tool(
    async ({ path }) => {
      const full = path.startsWith("/") ? path : `${computer.home}/${path.replace(/^~\/?/, "")}`;
      // Checked as this bot's own Linux user, like the read itself: other bots' files yes, private folders no.
      const stat = await computer.stub.exec(o.botId, `stat -L -c '%s %F' -- ${shellQuote(full)}`, 20_000);
      if (stat.exitCode !== 0) return `NOT DONE: ${stat.output.trim().slice(0, 200) || "cannot read that path"}`;
      const [size, ...kind] = stat.output.trim().split(" ");
      if (kind.join(" ") === "directory") {
        return "NOT DONE: that is a folder. Pack it first (e.g. `cd <parent> && zip -qr ~/<name>.zip <name>`, or tar -czf if zip is missing), then share the archive.";
      }
      if (Number(size) > MAX_FILE_BYTES) return `NOT DONE: the file is ${formatBytes(Number(size))}; the limit is ${formatBytes(MAX_FILE_BYTES)}. Compress or split it.`;
      const [read] = await computer.stub.download(o.botId, [full]);
      if (!read?.content) return `NOT DONE: cannot read ${full} (${read?.error ?? "unknown error"}).`;
      const file = await saveFile(o.bucket, o.db, { maxStorageBytes: o.maxStorageBytes }, {
        userId: o.userId,
        botId: o.botId,
        threadId: o.threadId,
        source: "computer",
        name: full.split("/").pop() ?? "file",
        bytes: read.content,
        computerPath: full,
      });
      return [
        `Shared ${describeFile(file)} with the user. They see a download button in the chat (a copy as of now; it works while the computer sleeps). Do not paste a link.`,
        fileMarker(file),
      ].join("\n");
    },
    {
      name: "share_file",
      description:
        "Give the user a file from the computer: it appears in the chat with a download button and stays in their files. " +
        "Works for your files and other bots' files. For a folder, zip it first. " +
        "Share ONLY the finished file(s) the user asked for, in the format they asked for (an Excel sheet = one .xlsx). " +
        "Never share intermediate or helper files (a CSV used to build a spreadsheet, scripts, temp files, screenshots), " +
        "and never re-share files from earlier requests. Share a second format only if the user asked for it.",
      schema: z.object({ path: z.string().min(1).max(500).describe("Absolute path of the file on the computer.") }),
    },
  );

  return [copyToComputer, shareFile];
}
