// The user's own skills (Settings > Skills). Uploads come through here, not straight
// to R2, so every file is checked (@repo/shared/skills checkSkill) before any is saved.
//   GET    /api/me/skills        -> the user's skills
//   POST   /api/me/skills        -> multipart: `files` (File) with matching `paths`
//                                   (each file's path in the skill folder), or one
//                                   .zip; one bad file rejects all, each problem listed
//   DELETE /api/me/skills/:name  -> removes the skill and its files
import { zValidator } from "@hono/zod-validator";
import { deleteFiles, deletePrefix, listFiles, putFile } from "@repo/shared/r2";
import { overLimit } from "@repo/shared/rate-limit";
import { userSkill } from "@repo/shared/schema";
import {
	checkSkill,
	MAX_SKILL_FILES,
	MAX_SKILLS_PER_USER,
	SKILL_NAME,
	skillPrefix,
	trimDescription,
	unzipSkill,
} from "@repo/shared/skills";
import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser } from "./auth";
import { db } from "./db";

const mine = (userId: string, name: string) =>
	and(eq(userSkill.userId, userId), eq(userSkill.name, name));

export const skills = new Hono<Env>()
	.use(requireUser)
	.get("/", async (c) => {
		// Only what the list shows: the name and a trimmed description.
		const rows = await db
			.select({ name: userSkill.name, description: userSkill.description })
			.from(userSkill)
			.where(eq(userSkill.userId, c.get("user").id))
			.orderBy(desc(userSkill.createdAt));
		return c.json(
			{
				skills: rows.map((r) => ({
					name: r.name,
					description: trimDescription(r.description),
				})),
			},
			200,
		);
	})
	.post("/", async (c) => {
		const userId = c.get("user").id;
		if (await overLimit(db, `skills-upload:${userId}`, 20, 60 * 60_000))
			return c.json({ error: "Too many uploads. Try again later." }, 429);
		const form = await c.req.formData().catch(() => null);
		const files = form?.getAll("files") ?? [];
		const paths = form?.getAll("paths") ?? [];
		if (
			files.length === 0 ||
			files.length > MAX_SKILL_FILES ||
			files.length !== paths.length ||
			!files.every((f) => f instanceof File) ||
			!paths.every((p) => typeof p === "string")
		)
			return c.json(
				{ error: "Send each file with its path (at most 50 files)." },
				400,
			);
		const sent = await Promise.all(
			(files as File[]).map(async (f, i) => ({
				path: paths[i] as string,
				bytes: new Uint8Array(await f.arrayBuffer()),
			})),
		);
		// One .zip: unpack it (fflate, size counted while unpacking), then check as usual.
		const input =
			sent.length === 1 && sent[0].path.toLowerCase().endsWith(".zip")
				? unzipSkill(sent[0].bytes)
				: sent;
		if (!Array.isArray(input)) return c.json({ problems: [input] }, 422);
		const checked = checkSkill(input);
		if (!checked.ok) return c.json({ problems: checked.problems }, 422);

		const [old] = await db
			.select({ prefix: userSkill.prefix })
			.from(userSkill)
			.where(mine(userId, checked.name));
		if (!old) {
			const [{ n }] = await db
				.select({ n: count() })
				.from(userSkill)
				.where(eq(userSkill.userId, userId));
			if (n >= MAX_SKILLS_PER_USER)
				return c.json(
					{ error: `You can have at most ${MAX_SKILLS_PER_USER} skills.` },
					409,
				);
		}
		// One folder per skill. A re-upload overwrites it, then drops files it no longer has.
		// shortcut: a failed re-upload can leave the folder half new, half old; upload
		// again to fix it. Use a staging folder if that becomes a problem.
		const prefix = skillPrefix(userId, checked.name);
		try {
			await Promise.all(
				checked.files.map((f) => putFile(prefix + f.path, f.bytes, f.type)),
			);
		} catch (error) {
			console.error("skill upload failed", error);
			if (!old) await deletePrefix(prefix).catch(() => {});
			return c.json({ error: "Saving the skill failed. Try again." }, 502);
		}
		const keep = new Set(checked.files.map((f) => prefix + f.path));
		const stale = (await listFiles(prefix).catch(() => []))
			.map((f) => f.key)
			.filter((k) => !keep.has(k));
		if (stale.length) await deleteFiles(stale);
		const row = {
			name: checked.name,
			description: checked.description,
			prefix,
			files: checked.files.map((f) => ({
				path: f.path,
				size: f.bytes.byteLength,
				type: f.type,
			})),
		};
		await db
			.insert(userSkill)
			.values({ userId, ...row })
			.onConflictDoUpdate({
				target: [userSkill.userId, userSkill.name],
				set: { ...row, createdAt: new Date() },
			});
		// Skills saved before the one-folder layout lived elsewhere.
		if (old && old.prefix !== prefix)
			await deletePrefix(old.prefix).catch((e) =>
				console.error("old skill files not deleted", e),
			);
		return c.json(
			{ name: row.name, description: trimDescription(row.description) },
			200,
		);
	})
	.delete(
		"/:name",
		zValidator("param", z.object({ name: z.string().regex(SKILL_NAME) })),
		async (c) => {
			const userId = c.get("user").id;
			const [row] = await db
				.delete(userSkill)
				.where(mine(userId, c.req.valid("param").name))
				.returning({ prefix: userSkill.prefix });
			if (!row) return c.json({ error: "Not found" }, 404);
			await deletePrefix(row.prefix).catch((e) =>
				console.error("skill files not deleted", e),
			);
			return c.json({ ok: true }, 200);
		},
	);
