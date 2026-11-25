import { expect, test } from "bun:test";
import { checkSkill, skillPrefix } from "./skills";

const text = (s: string) => new TextEncoder().encode(s);
const md = text(
	"---\nname: blog-writer\ndescription: Use when writing a blog post.\n---\nSteps.",
);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("a picked folder with text, code and an image passes", () => {
	const r = checkSkill([
		{ path: "blog/SKILL.md", bytes: md },
		{ path: "blog/scripts/run.py", bytes: text("print(1)") },
		{ path: "blog/assets/logo.png", bytes: png },
	]);
	expect(r.ok).toBe(true);
	if (!r.ok) return;
	expect(r.name).toBe("blog-writer");
	expect(r.files.map((f) => f.path)).toEqual([
		"SKILL.md",
		"scripts/run.py",
		"assets/logo.png",
	]);
});

test("bad files reject the whole skill and say which and why", () => {
	const r = checkSkill([
		{ path: "SKILL.md", bytes: md },
		{ path: ".env", bytes: text("KEY=1") },
		{ path: "../etc/passwd", bytes: text("x") },
		{ path: "tool.exe", bytes: text("MZ") },
		{ path: "fake.png", bytes: text("not an image") },
		{ path: "bin.txt", bytes: new Uint8Array([0xff, 0xfe, 0x00]) },
	]);
	expect(r.ok).toBe(false);
	if (r.ok) return;
	expect(r.problems.map((p) => p.file)).toEqual([
		".env",
		"../etc/passwd",
		"tool.exe",
		"fake.png",
		"bin.txt",
	]);
});

test("SKILL.md needs a valid name and description", () => {
	const r = checkSkill([
		{ path: "SKILL.md", bytes: text("---\nname: ../x\n---\n") },
	]);
	expect(r.ok).toBe(false);
	expect(checkSkill([{ path: "notes.md", bytes: md }]).ok).toBe(false);
});

test("skills sit outside the chat-file prefix", () => {
	expect(skillPrefix("u1", "blog")).toBe("u/u1/s/blog/");
});

test("a zip unpacks, skipping macOS junk; a zip bomb stops at 10 MB", async () => {
	const { zipSync } = await import("fflate");
	const { unzipSkill } = await import("./skills");
	const files = unzipSkill(
		zipSync({
			"blog/SKILL.md": md,
			"blog/.DS_Store": text("x"),
			"__MACOSX/blog/._SKILL.md": text("x"),
		}),
	);
	expect(Array.isArray(files)).toBe(true);
	const r = checkSkill(files as never);
	expect(r.ok && r.files.map((f) => f.path)).toEqual(["SKILL.md"]);
	const bomb = zipSync({ "a.txt": new Uint8Array(11 * 1024 * 1024) });
	expect(unzipSkill(bomb)).toEqual({
		file: "",
		issue: "Unpacked, the zip is over 10 MB.",
	});
	expect(unzipSkill(text("not a zip"))).toMatchObject({ file: "" });
});
