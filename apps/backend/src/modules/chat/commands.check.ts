import assert from "node:assert/strict";
import { deepResearchQuestion, researchInstruction } from "./commands";

assert.equal(deepResearchQuestion("/deep-research  EU AI act fines "), "EU AI act fines");
assert.equal(deepResearchQuestion("/deep-research"), "", "no question");
assert.equal(deepResearchQuestion("/deep-researcher x"), null, "another word");
assert.equal(deepResearchQuestion("tell me about /deep-research"), null, "not at the start");
assert.match(researchInstruction("q"), /tavily_research exactly once/);
console.log("commands: all checks passed");
