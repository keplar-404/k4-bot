import { expect, test } from "bun:test";
import { chatPrefix, cleanFileName, fileKey, ownsKey, typeOf } from "./files";

test("file names lose directories and control characters", () => {
	expect(cleanFileName("/etc/passwd")).toBe("passwd");
	expect(cleanFileName("C:\\secret\\report.pdf")).toBe("report.pdf");
	expect(cleanFileName("  a\u0000b\n.txt  ")).toBe("ab.txt");
	expect(cleanFileName("x".repeat(256))).toBeNull();
	expect(cleanFileName("")).toBeNull();
});

test("file keys stay under the owner and chat", () => {
	const key = fileKey("u|1", "chat-2", "a b.pdf");
	expect(key.startsWith(chatPrefix("u|1", "chat-2"))).toBe(true);
	expect(key.endsWith("/a%20b.pdf")).toBe(true);
	expect(ownsKey("u|1", key)).toBe(true);
});

test("a user can't reach another user's keys or climb out of their own", () => {
	const key = fileKey("u1", "c1", "x.txt");
	expect(ownsKey("u2", key)).toBe(false);
	expect(ownsKey("u1", "u/u1/c/../../u2/c/c1/x")).toBe(false);
	expect(ownsKey("u1", "u/u1/c//x")).toBe(false);
	expect(ownsKey("u1", "u/u10/c/c1/x")).toBe(false);
});

test("file types come from the name, unknown ones are octet-stream", () => {
	expect(typeOf("/home/a/Media/x-image.webp")).toBe("image/webp");
	expect(typeOf("REPORT.PDF")).toBe("application/pdf");
	expect(typeOf("Makefile")).toBe("application/octet-stream");
});
