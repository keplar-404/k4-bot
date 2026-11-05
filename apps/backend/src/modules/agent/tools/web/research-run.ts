import { TavilyError } from "./client";
import { type ResearchParams, startResearch, waitForResearch } from "./research";
import { type ResearchArchive, researchKey } from "./research-archive";
import { forModel, reportMarkdown, reportName } from "./research-report";

const FAILED = "NOT DONE: Tavily's research agent could not finish this task. Tell the user, and offer to research it yourself with tavily_search.";

/**
 * One /deep-research request, paid for at most once per thread:
 * - already completed with these arguments: the saved report again (no new task);
 * - started but not finished (a crashed or retried run, or the user asking again), or finished but its file is
 *   gone: poll that same task again;
 * - otherwise: start a task and save its id before polling.
 * The finished report is saved as a file first, then given to the model, so a model or budget failure after this
 * point loses nothing: the next run reads the file.
 */
export async function runResearch(apiKey: string, params: ResearchParams, o: { archive?: ResearchArchive; signal?: AbortSignal; pollMs?: number }): Promise<string> {
  const { archive } = o;
  const key = await researchKey(params);
  const saved = await archive?.find(key);

  if (saved?.status === "completed" && saved.fileId) {
    const report = await archive!.loadReport(saved.fileId);
    if (report) return forModel(report.markdown, report.file, true);
  }

  // Pending, or completed but its file is gone: fetch that same task again (Tavily keeps it), never a new one.
  let requestId = saved && saved.status !== "failed" ? saved.requestId : undefined;
  let task;
  try {
    if (!requestId) {
      requestId = await startResearch(apiKey, params);
      await archive?.start(key, requestId);
    }
    task = await waitForResearch(apiKey, requestId, o);
  } catch (error) {
    // Tavily forgot a task we were resuming: start one new task (saved like the first).
    if (!(error instanceof TavilyError && error.status === 404 && saved && saved.status !== "failed")) throw error;
    requestId = await startResearch(apiKey, params);
    await archive?.start(key, requestId);
    task = await waitForResearch(apiKey, requestId, o);
  }

  if (task.status !== "completed") {
    await archive?.finish(key, "failed");
    return FAILED;
  }
  const markdown = reportMarkdown(task, params.input);
  const file = archive ? await archive.saveReport(reportName(params.input), markdown).catch((e: unknown) => (e instanceof Error ? e.message : String(e))) : "file storage is not set up";
  await archive?.finish(key, "completed", typeof file === "string" ? undefined : file.id);
  return forModel(markdown, file);
}
