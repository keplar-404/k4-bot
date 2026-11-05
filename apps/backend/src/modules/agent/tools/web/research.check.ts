import assert from "node:assert/strict";
import { takeFileMarkers } from "../../parts";
import { memoryResearchArchive, researchKey } from "./research-archive";
import { INLINE_CHARS } from "./research-report";
import { runResearch } from "./research-run";

/** Every edge case of /deep-research against a fake Tavily: what is called, what is saved, what the model gets. */
type Reply = { status: number; body: object };
let calls: string[] = [];
let replies: Reply[] = [];
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  calls.push(`${init?.method} ${new URL(url).pathname}`);
  const r = replies.shift() ?? { status: 500, body: { detail: "unexpected call" } };
  return new Response(JSON.stringify(r.body), { status: r.status });
}) as typeof fetch;
const reset = (...r: Reply[]) => ((calls = []), (replies = r));
const started = (id: string): Reply => ({ status: 201, body: { request_id: id, status: "pending" } });
const working = (id: string): Reply => ({ status: 202, body: { request_id: id, status: "in_progress" } });
const done = (id: string, content = "Report body"): Reply => ({ status: 200, body: { request_id: id, status: "completed", content, sources: [{ title: "Src", url: "https://a.example" }] } });
const params = { input: "AI bubble in China 2026", model: "mini" as const };
const o = (archive: ReturnType<typeof memoryResearchArchive>) => ({ archive, pollMs: 1 });

// 1. A new request: start, save the id, poll until done, save the report file, hand it over with its file card.
const a = memoryResearchArchive();
reset(started("t1"), working("t1"), done("t1"));
const first = await runResearch("k", params, o(a));
assert.deepEqual(calls, ["POST /research", "GET /research/t1", "GET /research/t1"]);
const { text, files } = takeFileMarkers(first);
assert.match(text, /Report body/);
assert.match(text, /## Sources\n1\. \[Src\]\(https:\/\/a\.example\) · a\.example/);
assert.equal(files.length, 1, "download card");
assert.equal(a.files.get(files[0]!.id)!.markdown.includes("Report body"), true, "full report stored");
const key = await researchKey(params);
assert.deepEqual(await a.find(key), { requestId: "t1", status: "completed", fileId: files[0]!.id });

// 2. Same request again (a retried run, or the user asking again): the saved report, no Tavily call, no new charge.
reset();
const again = await runResearch("k", { model: "mini", input: "AI bubble in China 2026" }, o(a));
assert.deepEqual(calls, [], "argument order does not matter");
assert.match(again, /already done for the same question/);

// 3. The run died while waiting: the next try polls the same task, it never starts a second paid one.
const b = memoryResearchArchive();
await b.start(key, "t2");
reset(working("t2"), done("t2"));
await runResearch("k", params, o(b));
assert.deepEqual(calls, ["GET /research/t2", "GET /research/t2"]);

// 4. Tavily forgot the task being resumed (404): exactly one new task, saved like the first.
const c = memoryResearchArchive();
await c.start(key, "gone");
reset({ status: 404, body: { detail: { error: "not found" } } }, started("t3"), done("t3"));
await runResearch("k", params, o(c));
assert.deepEqual(calls, ["GET /research/gone", "POST /research", "GET /research/t3"]);
assert.equal((await c.find(key))!.requestId, "t3");

// 5. Completed, but the report file was deleted: fetch the same task again, no new task.
const d = memoryResearchArchive();
await d.start(key, "t4");
await d.finish(key, "completed", "deleted-file");
reset(done("t4"));
await runResearch("k", params, o(d));
assert.deepEqual(calls, ["GET /research/t4"]);

// 6. A long report stays below Deep Agents' 80,000-character eviction: head + sources + where the rest is.
const e = memoryResearchArchive();
reset(started("t5"), done("t5", "x".repeat(150_000)));
const long = takeFileMarkers(await runResearch("k", params, o(e)));
assert.ok(long.text.length < 80_000 && long.text.length > INLINE_CHARS - 100, `inline ${long.text.length} chars`);
assert.match(long.text, /continues for \d+ more characters\. Read the rest with read_document, file id /);
assert.match(long.text, /## Sources/, "sources kept");
assert.equal(e.files.get(long.files[0]!.id)!.markdown.length > 150_000, true, "file has all of it");

// 7. Storage full: the model still gets the report, and is told it is not saved.
const f = { ...memoryResearchArchive(), saveReport: async () => { throw new Error("File storage is full"); } };
reset(started("t6"), done("t6"));
const unsaved = await runResearch("k", params, { archive: f, pollMs: 1 });
assert.match(unsaved, /Report body[\s\S]*could not be saved as a file \(File storage is full\)/);

// 8. Tavily failed the task: recorded, and the model is told plainly. The next try starts fresh.
const g = memoryResearchArchive();
reset(started("t7"), { status: 200, body: { request_id: "t7", status: "failed" } });
assert.match(await runResearch("k", params, o(g)), /^NOT DONE/);
assert.equal((await g.find(key))!.status, "failed");

// 9. Stop: the wait ends at once and the task stays pending, so asking again picks it up.
const h = memoryResearchArchive();
const stop = new AbortController();
reset(started("t8"), working("t8"), working("t8"));
const pending = runResearch("k", params, { archive: h, signal: stop.signal, pollMs: 50 });
setTimeout(() => stop.abort(), 20);
await assert.rejects(pending, /Stopped/);
assert.equal((await h.find(key))!.status, "pending");

console.log("deep research: all checks passed");
