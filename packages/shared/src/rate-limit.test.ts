import { expect, test } from "bun:test";
import { overLimitInMemory } from "./rate-limit";

test("in-memory limit counts per key and resets after the window", async () => {
	const key = `t:${crypto.randomUUID()}`;
	expect(overLimitInMemory(key, 2, 50)).toBe(false);
	expect(overLimitInMemory(key, 2, 50)).toBe(false);
	expect(overLimitInMemory(key, 2, 50)).toBe(true);
	expect(overLimitInMemory(`${key}:other`, 2, 50)).toBe(false);
	await Bun.sleep(60);
	expect(overLimitInMemory(key, 2, 50)).toBe(false);
});
