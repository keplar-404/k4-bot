// User uploads in Neon Object Storage (bucket S3_BUCKET). The browser uploads
// straight to the bucket with a signed form, so file bytes never pass through
// this API (no function body limit, no transfer through us). Neon docs:
// storage/s3-compatibility (presigned POST, path-style, SigV4).
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { zValidator } from "@hono/zod-validator";
import { file } from "@repo/shared/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireUser } from "./auth";
import { db } from "./db";

const MAX_BYTES = 10 * 1024 * 1024;
const bucket = process.env.S3_BUCKET ?? "uploads";
// Created on first use, so the app (and its tests) load without storage keys.
let client: S3Client | undefined;
const s3 = () =>
	(client ??= new S3Client({
		endpoint: process.env.AWS_ENDPOINT_URL_S3,
		forcePathStyle: true,
	}));

export const files = new Hono<Env>()
	.use(requireUser)
	// A row plus a signed upload form. The storage enforces the size and type,
	// so a client can't send more than it declared.
	.post(
		"/",
		zValidator(
			"json",
			z.object({
				name: z.string().trim().min(1).max(200),
				type: z.string().min(1).max(100),
			}),
		),
		async (c) => {
			const { name, type } = c.req.valid("json");
			const id = crypto.randomUUID();
			const key = `${c.get("user").id}/${id}`;
			const form = await createPresignedPost(s3(), {
				Bucket: bucket,
				Key: key,
				Fields: { "Content-Type": type },
				Conditions: [
					["content-length-range", 1, MAX_BYTES],
					["eq", "$Content-Type", type],
				],
				Expires: 300,
			});
			await db
				.insert(file)
				.values({ id, userId: c.get("user").id, key, name, type });
			return c.json({ id, url: form.url, fields: form.fields }, 201);
		},
	)
	// A short-lived download link, only for the owner.
	// ponytail: a row whose upload never happened (refused or abandoned) still
	// returns a link, which answers 404 from storage; add a confirm step if listed.
	.get("/:id", zValidator("param", z.object({ id: z.uuid() })), async (c) => {
		const [row] = await db
			.select({ key: file.key, name: file.name })
			.from(file)
			.where(
				and(
					eq(file.id, c.req.valid("param").id),
					eq(file.userId, c.get("user").id),
				),
			);
		if (!row) return c.json({ error: "Not found" }, 404);
		const url = await getSignedUrl(
			s3(),
			new GetObjectCommand({
				Bucket: bucket,
				Key: row.key,
				ResponseContentDisposition: `inline; filename="${encodeURIComponent(row.name)}"`,
			}),
			{ expiresIn: 3600 },
		);
		return c.json({ name: row.name, url }, 200);
	});
