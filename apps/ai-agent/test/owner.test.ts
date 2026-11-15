import { expect, test } from "bun:test";
import { assertSessionOwner } from "../agent/lib/owner";

test("the owner and a new session are allowed", async () => {
	await assertSessionOwner(async () => "u1", "u1");
	await assertSessionOwner(async () => null, "u1");
});

test("another user's session is refused", async () => {
	await expect(assertSessionOwner(async () => "u2", "u1")).rejects.toThrow();
});

test("a failed owner lookup refuses instead of allowing", async () => {
	await expect(
		assertSessionOwner(async () => {
			throw new Error("store down");
		}, "u1"),
	).rejects.toThrow();
});
