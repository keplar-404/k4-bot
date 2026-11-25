import { and, asc, eq, ilike, or } from "drizzle-orm";
import { Unzip, UnzipInflate } from "fflate";
import type { Db } from "./db";
import { userSkill } from "./schema";

// User skills (Agent Skills format): a folder with a SKILL.md and optional text, code
// and image files. The backend checks every upload with checkSkill before anything
// reaches R2; one bad file rejects the whole upload. Files live under the owner's
// prefix (skillPrefix), and the user_skill table lists them for the agent.

export const MAX_SKILL_FILES = 50;
export const MAX_SKILL_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_BYTES = 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SKILLS_PER_USER = 200;
const MAX_DEPTH = 5;
const MAX_DESCRIPTION = 1024;

const TEXT: Record<string, string> = {
	md: "text/markdown",
	txt: "text/plain",
	json: "application/json",
	yaml: "text/yaml",
	yml: "text/yaml",
	csv: "text/csv",
	py: "text/x-python",
	js: "text/javascript",
	ts: "text/plain",
	sh: "text/x-shellscript",
};
// Each image type and the bytes its files start with.
const IMAGE: Record<
	string,
	{ type: string; magic: (b: Uint8Array) => boolean }
> = {
	png: {
		type: "image/png",
		magic: (b) =>
			b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
	},
	jpg: {
		type: "image/jpeg",
		magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
	},
	jpeg: {
		type: "image/jpeg",
		magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
	},
	gif: {
		type: "image/gif",
		magic: (b) => String.fromCharCode(...b.subarray(0, 4)) === "GIF8",
	},
	webp: {
		type: "image/webp",
		magic: (b) =>
			String.fromCharCode(...b.subarray(0, 4)) === "RIFF" &&
			String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
	},
};

/** Same rule as eve's skill names: letters, digits, _ and -, at most 64. */
export const SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const PART = /^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,99}$/;

export type SkillFile = { path: string; bytes: Uint8Array };
/** What user_skill.files keeps for each file. */
export type SkillFileInfo = { path: string; size: number; type: string };
// Left behind by macOS and Windows; dropped quietly instead of rejecting the upload.
const JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/;
export type CheckedFile = { path: string; type: string; bytes: Uint8Array };
export type SkillProblem = { file: string; issue: string };
export type CheckedSkill =
	| { ok: true; name: string; description: string; files: CheckedFile[] }
	| { ok: false; problems: SkillProblem[] };

/** A user's skill folder in R2: every file of that skill. Not under `u/<user>/c/`, so chat file routes can't reach it. */
export const skillPrefix = (userId: string, name: string) =>
	`u/${encodeURIComponent(userId)}/s/${name}/`;

/** The Skills list shows this much of a description. */
export const trimDescription = (d: string, max = 160) =>
	d.length > max ? `${d.slice(0, max - 1).trimEnd()}…` : d;

const utf8 = new TextDecoder("utf-8", { fatal: true });

/** The SKILL.md frontmatter's name and description (plain `key: value` lines). */
export function frontmatter(text: string) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
	if (!m) return {};
	const out: Record<string, string> = {};
	for (const line of m[1].split(/\r?\n/)) {
		const kv = /^(name|description):\s*(.*)$/.exec(line);
		if (kv) out[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
	}
	return out as { name?: string; description?: string };
}

/**
 * Checks an uploaded skill. Paths are relative to the skill folder; a folder picked
 * in the browser arrives with its own name first, which is stripped here.
 */
export function checkSkill(upload: SkillFile[]): CheckedSkill {
	const input = upload.filter((f) => !JUNK.test(f.path));
	const problems: SkillProblem[] = [];
	const bad = (file: string, issue: string) => problems.push({ file, issue });
	if (input.length === 0)
		return { ok: false, problems: [{ file: "", issue: "No files." }] };
	if (input.length > MAX_SKILL_FILES)
		bad(
			"",
			`Too many files (${input.length}); the limit is ${MAX_SKILL_FILES}.`,
		);
	const total = input.reduce((n, f) => n + f.bytes.byteLength, 0);
	if (total > MAX_SKILL_BYTES)
		bad(
			"",
			`The skill is ${(total / 1048576).toFixed(1)} MB; the limit is 10 MB.`,
		);

	// A picked folder: every path starts with the same folder name. Drop it.
	const first = input[0].path.split("/")[0];
	const nested =
		input.every(
			(f) => f.path.split("/").length > 1 && f.path.split("/")[0] === first,
		) && !input.some((f) => f.path === "SKILL.md");
	const files: CheckedFile[] = [];
	const seen = new Set<string>();
	for (const f of input) {
		const path = nested ? f.path.split("/").slice(1).join("/") : f.path;
		const parts = path.split("/");
		if (
			!path ||
			path.includes("\\") ||
			parts.length > MAX_DEPTH ||
			!parts.every((p) => PART.test(p) && !p.endsWith("."))
		) {
			bad(
				f.path,
				"Not an allowed file name (hidden files, `..`, odd characters or too deep).",
			);
			continue;
		}
		if (seen.has(path)) {
			bad(f.path, "The same file twice.");
			continue;
		}
		seen.add(path);
		const ext = path.split(".").pop()?.toLowerCase() ?? "";
		const image = IMAGE[ext];
		if (image) {
			if (f.bytes.byteLength > MAX_IMAGE_BYTES)
				bad(path, "Images can be at most 5 MB.");
			else if (!image.magic(f.bytes)) bad(path, `Not a real .${ext} image.`);
			else files.push({ path, type: image.type, bytes: f.bytes });
			continue;
		}
		const type = TEXT[ext];
		if (!type) {
			bad(path, `.${ext} files aren't allowed. Only text, code and images.`);
			continue;
		}
		if (f.bytes.byteLength > MAX_TEXT_BYTES) {
			bad(path, "Text files can be at most 1 MB.");
			continue;
		}
		let text: string;
		try {
			text = utf8.decode(f.bytes);
		} catch {
			bad(path, "Not a text file (it isn't UTF-8).");
			continue;
		}
		if (text.includes("\0")) bad(path, "Not a text file (it has null bytes).");
		else files.push({ path, type: `${type}; charset=utf-8`, bytes: f.bytes });
	}

	const skillMd = files.find((f) => f.path === "SKILL.md");
	let name = "";
	let description = "";
	if (!skillMd)
		bad("SKILL.md", "Every skill needs a SKILL.md at the top of its folder.");
	else {
		const meta = frontmatter(utf8.decode(skillMd.bytes));
		name = meta.name ?? "";
		description = meta.description ?? "";
		if (!SKILL_NAME.test(name))
			bad(
				"SKILL.md",
				"Needs `name:` in its frontmatter: letters, digits, _ or -, at most 64.",
			);
		if (!description || description.length > MAX_DESCRIPTION)
			bad(
				"SKILL.md",
				"Needs `description:` in its frontmatter (at most 1,024 characters).",
			);
	}
	return problems.length
		? { ok: false, problems }
		: { ok: true, name, description, files };
}

/**
 * The files in a .zip, counted while they unpack: past MAX_SKILL_BYTES or
 * MAX_SKILL_FILES it stops, so a small "zip bomb" can't fill the server's memory.
 */
export function unzipSkill(zip: Uint8Array): SkillFile[] | SkillProblem {
	const files: SkillFile[] = [];
	let total = 0;
	let problem: SkillProblem | undefined;
	try {
		const uz = new Unzip((entry) => {
			if (problem || entry.name.endsWith("/")) return;
			if (files.length >= MAX_SKILL_FILES * 2) {
				problem = { file: "", issue: "The zip has too many files." };
				return;
			}
			const chunks: Uint8Array[] = [];
			entry.ondata = (err, chunk, final) => {
				if (problem) return;
				if (err) {
					problem = {
						file: entry.name,
						issue: "This file in the zip is damaged.",
					};
					return;
				}
				total += chunk.byteLength;
				if (total > MAX_SKILL_BYTES) {
					problem = { file: "", issue: "Unpacked, the zip is over 10 MB." };
					entry.terminate();
					return;
				}
				chunks.push(chunk);
				if (final)
					files.push({ path: entry.name, bytes: Buffer.concat(chunks) });
			};
			entry.start();
		});
		uz.register(UnzipInflate);
		uz.push(zip, true);
	} catch {
		return { file: "", issue: "Not a valid .zip file." };
	}
	if (problem) return problem;
	return files.length ? files : { file: "", issue: "The zip is empty." };
}

const brief = { name: userSkill.name, description: userSkill.description };

/** The user's skills, by name: what the agent is told it has. */
export const listSkills = (db: Db, userId: string, limit: number) =>
	db
		.select(brief)
		.from(userSkill)
		.where(eq(userSkill.userId, userId))
		.orderBy(asc(userSkill.name))
		.limit(limit);

/** The user's skills whose name or description has every word of `query`. */
export function findSkills(db: Db, userId: string, query: string) {
	const words =
		query
			.toLowerCase()
			.match(/[\p{L}\p{N}]+/gu)
			?.slice(0, 8) ?? [];
	return db
		.select(brief)
		.from(userSkill)
		.where(
			and(
				eq(userSkill.userId, userId),
				...words.map((w) =>
					or(
						ilike(userSkill.name, `%${w}%`),
						ilike(userSkill.description, `%${w}%`),
					),
				),
			),
		)
		.orderBy(asc(userSkill.name))
		.limit(10);
}

/** One of the user's skills, or undefined. Only ever looked up under the caller's own id. */
export async function getSkill(db: Db, userId: string, name: string) {
	const [row] = await db
		.select()
		.from(userSkill)
		.where(and(eq(userSkill.userId, userId), eq(userSkill.name, name)));
	return row;
}
