import { expect, test } from "bun:test";
import { memoryFacts } from "./memory";

test("memory facts are trimmed lines without blanks", () => {
	expect(memoryFacts("  a fact \n\n\tanother\n  ")).toEqual([
		"a fact",
		"another",
	]);
	expect(memoryFacts("")).toEqual([]);
});
