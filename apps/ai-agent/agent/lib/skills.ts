// Reading the signed-in user's skills, for the skill tools. Skills stay in R2 and are
// never copied to the computer: the model reads them through these tools only. Every
// lookup starts from the caller's verified user id, never from model input.
import { getText } from "@repo/shared/r2";
import { getSkill } from "@repo/shared/skills";
import { appUserId, db } from "./db";

type Ctx = { session: { auth: { current: Parameters<typeof appUserId>[0] } } };

/** At most this much text goes back per call; the model asks for more by line. */
export const MAX_LINES = 400;
export const MAX_CHARS = 40_000;

type Skill = NonNullable<Awaited<ReturnType<typeof getSkill>>>;

/** The caller's skill and, if `path` is given, that file's entry. */
export async function mySkill(
	ctx: Ctx,
	name: string,
	path?: string,
): Promise<
	{ error: string } | { skill: Skill; file?: Skill["files"][number] }
> {
	const userId = appUserId(ctx.session.auth.current);
	if (!userId) return { error: "Sign in to use skills." };
	const skill = await getSkill(db(), userId, name);
	if (!skill) return { error: `No skill named ${name}. Try find_skill.` };
	const file = path ? skill.files.find((f) => f.path === path) : undefined;
	if (path && !file)
		return {
			error: `${name} has no file ${path}. Its files: ${skill.files.map((f) => f.path).join(", ")}`,
		};
	return { skill, file };
}

export const isText = (type: string) => !type.startsWith("image/");

export const readText = (prefix: string, path: string) =>
	getText(prefix + path);

/** Lines from..from+count of a text (1-based), capped at MAX_CHARS. */
export function lines(text: string, from = 1, count = MAX_LINES) {
	const all = text.split("\n");
	const start = Math.max(1, from);
	let out = all
		.slice(start - 1, start - 1 + Math.min(count, MAX_LINES))
		.join("\n");
	if (out.length > MAX_CHARS) out = out.slice(0, MAX_CHARS);
	const shown = out.split("\n").length;
	const end = start + shown - 1;
	return {
		text: out,
		lines: `${start}-${end} of ${all.length}`,
		...(end < all.length ? { more: `Read on from line ${end + 1}.` } : {}),
	};
}
