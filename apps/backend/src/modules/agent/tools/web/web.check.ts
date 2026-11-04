import assert from "node:assert/strict";
import { deepResearchQuestion } from "../../../chat/commands";
import { memoryBudgetStore } from "./budget";
import { crawlCost, extractCost, mapCost, researchCost, searchCost } from "./costs";
import { WebGuard } from "./guard";

// Costs, from https://docs.tavily.com/documentation/api-credits
assert.equal(searchCost({ search_depth: "basic" }), 1);
assert.equal(searchCost({ search_depth: "advanced" }), 2);
assert.equal(searchCost({ search_depth: "fast", auto_parameters: true }), 2, "auto_parameters costs 2");
assert.equal(extractCost({ urls: ["a", "b", "c", "d", "e", "f"], extract_depth: "basic" }), 2, "1 per 5 URLs");
assert.equal(extractCost({ urls: ["a"], extract_depth: "advanced" }), 2);
assert.equal(mapCost({ limit: 50 }), 5);
assert.equal(mapCost({ limit: 50, instructions: "docs" }), 10, "instructions double it");
assert.equal(crawlCost({ limit: 20, instructions: "x", extract_depth: "basic" }), 4 + 4);
assert.equal(researchCost({ model: "mini" }), 110);
assert.equal(researchCost({ model: "auto" }), 250, "auto may pick pro");

// Command parsing
assert.equal(deepResearchQuestion("/deep-research  EU AI act fines "), "EU AI act fines");
assert.equal(deepResearchQuestion("/deep-research"), "", "no question");
assert.equal(deepResearchQuestion("/deep-researcher x"), null, "another word");
assert.equal(deepResearchQuestion("tell me about /deep-research"), null, "not at the start");

const limits = { perDay: 100, perUserPerDay: 30, perRun: 10, researchPerUserPerDay: 1 };
const billed = (credits?: number) => async () => ({ text: "ok", credits });

// Reserve, then settle to the real cost
{
  const store = memoryBudgetStore();
  const guard = new WebGuard(store, { userId: "u", runId: "r" }, limits);
  assert.equal(await guard.run("search", { q: 1 }, 2, billed(1)), "ok");
  assert.deepEqual(await store.used("run:r"), { credits: 1, calls: 1 }, "settled to the real 1 credit");
  assert.equal((await store.used("all")).credits, 1);
  // Without a reported cost the reservation stands
  await guard.run("search", { q: 2 }, 2, billed(undefined));
  assert.equal((await store.used("user:u")).credits, 3);
}

// Identical calls are free, a run's cap stops a spree, and the refusal says what to do
{
  const store = memoryBudgetStore();
  const guard = new WebGuard(store, { userId: "u", runId: "r" }, limits);
  let sent = 0;
  const count = async () => (sent++, { text: "r", credits: 2 });
  await guard.run("search", { q: "same" }, 2, count);
  const again = await guard.run("search", { q: "same" }, 2, count);
  assert.equal(sent, 1, "second identical call not sent");
  assert.match(again, /from memory, at no cost/);
  for (let i = 0; i < 10; i++) await guard.run("search", { q: i }, 2, count);
  assert.equal(sent, 5, "10 credits per run = 5 calls of 2");
  assert.match(await guard.run("search", { q: "more" }, 2, count), /^NOT DONE: This task has used its web budget/);
  assert.equal((await store.used("all")).credits, 10, "refused calls hold nothing");
}

// The user's daily cap spans runs; research has its own daily count and skips the run cap
{
  const store = memoryBudgetStore();
  const run = (id: string) => new WebGuard(store, { userId: "u", runId: id }, limits);
  for (const id of ["a", "b", "c"]) for (let i = 0; i < 5; i++) await run(id).run("search", { id, i }, 2, billed(2));
  assert.match(await run("d").run("search", {}, 2, billed(2)), /user's daily web budget/);
  const fresh = memoryBudgetStore();
  const r = new WebGuard(fresh, { userId: "v", runId: "x" }, { ...limits, perDay: 1000, perUserPerDay: 1000 });
  assert.equal(await r.run("research", { input: "a" }, 110, billed(40), true), "ok", "110 > run cap, still allowed");
  assert.match(await r.run("research", { input: "b" }, 110, billed(40), true), /deep research runs/);
}

// A failed call is refunded and not cached; a broken budget store fails closed
{
  const store = memoryBudgetStore();
  const guard = new WebGuard(store, { userId: "u", runId: "r" }, limits);
  await assert.rejects(guard.run("extract", { u: 1 }, 2, async () => { throw new Error("boom"); }), /boom/);
  assert.deepEqual(await store.used("run:r"), { credits: 0, calls: 0 }, "refunded");
  assert.equal(await guard.run("extract", { u: 1 }, 2, billed(2)), "ok", "retried, not served from cache");
  const broken = new WebGuard({ ...store, reserve: async () => { throw new Error("db down"); } }, { userId: "u", runId: "r" }, limits);
  let called = false;
  assert.match(await broken.run("search", {}, 1, async () => ((called = true), { text: "x" })), /could not be checked/);
  assert.equal(called, false, "no call without a budget check");
}

console.log("web tools: all checks passed");
