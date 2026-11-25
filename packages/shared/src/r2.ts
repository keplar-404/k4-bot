// Cloudflare R2, S3-compatible. All bytes go browser/computer → R2 directly; this
// module only signs short URLs and checks what actually landed. The AWS SDK loads on
// first use (eve: keep the bundle small), so code that never touches files never
// loads it, and a checkout without storage credentials still imports the app.
import { FILE_URL_TTL_SECONDS, type FileMetadata } from "./files";

function config() {
	const accountId = process.env.R2_ACCOUNT_ID;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
	const bucket = process.env.R2_BUCKET;
	if (!accountId || !accessKeyId || !secretAccessKey || !bucket)
		throw new Error("R2 storage is not configured");
	return { accountId, accessKeyId, secretAccessKey, bucket };
}

let client: Promise<import("@aws-sdk/client-s3").S3Client> | undefined;
const s3 = () => {
	client ??= import("@aws-sdk/client-s3").then(({ S3Client }) => {
		const c = config();
		return new S3Client({
			region: "auto",
			endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: c.accessKeyId,
				secretAccessKey: c.secretAccessKey,
			},
		});
	});
	return client;
};
const sdk = () => import("@aws-sdk/client-s3");
const presigner = () => import("@aws-sdk/s3-request-presigner");

export type Head = { size: number; type: string };

export async function headFile(key: string): Promise<Head> {
	const { HeadObjectCommand } = await sdk();
	const { ContentLength, ContentType } = await (await s3()).send(
		new HeadObjectCommand({ Bucket: config().bucket, Key: key }),
	);
	return { size: Number(ContentLength ?? 0), type: ContentType ?? "" };
}

export async function deleteFile(key: string) {
	const { DeleteObjectCommand } = await sdk();
	await (await s3()).send(
		new DeleteObjectCommand({ Bucket: config().bucket, Key: key }),
	);
}

export type DeleteFilesResult = { deleted: string[]; failed: string[] };

/** One request per 1,000 keys. */
export async function deleteFiles(keys: string[]): Promise<DeleteFilesResult> {
	if (keys.length === 0) return { deleted: [], failed: [] };
	const { DeleteObjectsCommand } = await sdk();
	const deleted = new Set<string>();
	const failed = new Set<string>();
	for (let i = 0; i < keys.length; i += 1000) {
		const batch = keys.slice(i, i + 1000);
		try {
			const res = await (await s3()).send(
				new DeleteObjectsCommand({
					Bucket: config().bucket,
					Delete: {
						Objects: batch.map((Key) => ({ Key })),
						Quiet: true,
					},
				}),
			);
			for (const error of res.Errors ?? []) {
				if (error.Key) failed.add(error.Key);
			}
			for (const key of batch) if (!failed.has(key)) deleted.add(key);
		} catch (error) {
			console.error("batch R2 delete failed", error);
			for (const key of batch) failed.add(key);
		}
	}
	return { deleted: [...deleted], failed: [...failed] };
}

/** Every file under a prefix (a chat's files: files.ts chatPrefix). */
/** Every object under a prefix, oldest first. */
export async function listFiles(prefix: string) {
	const { ListObjectsV2Command } = await sdk();
	const files: { key: string; size: number; at: string }[] = [];
	let token: string | undefined;
	do {
		const page = await (await s3()).send(
			new ListObjectsV2Command({
				Bucket: config().bucket,
				Prefix: prefix,
				ContinuationToken: token,
			}),
		);
		for (const o of page.Contents ?? [])
			if (o.Key)
				files.push({
					key: o.Key,
					size: o.Size ?? 0,
					at: o.LastModified?.toISOString() ?? "",
				});
		token = page.NextContinuationToken;
	} while (token);
	return files.sort((a, b) => a.at.localeCompare(b.at));
}

export async function deletePrefix(prefix: string) {
	return deleteFiles((await listFiles(prefix)).map((f) => f.key));
}

export async function presignUpload(key: string, meta: FileMetadata) {
	const [{ PutObjectCommand }, { getSignedUrl }] = await Promise.all([
		sdk(),
		presigner(),
	]);
	return getSignedUrl(
		await s3(),
		new PutObjectCommand({
			Bucket: config().bucket,
			Key: key,
			ContentLength: meta.size,
			ContentType: meta.type,
		}),
		{
			expiresIn: 60,
			// R2 otherwise leaves both headers out of the signature: a caller could
			// swap the type or send more bytes than the check allowed.
			signableHeaders: new Set(["content-length", "content-type"]),
		},
	);
}

/** A filename with quotes or newlines cannot turn into a header injection. */
function disposition(name: string, inline = false) {
	return `${inline ? "inline" : "attachment"}; filename="${name.replace(/["\\\r\n]/g, "_")}"`;
}

export async function presignDownload(
	key: string,
	name: string,
	expiresIn = FILE_URL_TTL_SECONDS,
	inline = false,
) {
	const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
		sdk(),
		presigner(),
	]);
	return getSignedUrl(
		await s3(),
		new GetObjectCommand({
			Bucket: config().bucket,
			Key: key,
			ResponseContentDisposition: disposition(name, inline),
			ResponseCacheControl: `private, max-age=${expiresIn}`,
		}),
		// Signed at the start of the current window, so a file keeps the same URL for
		// that window and the browser serves it from its cache. Still valid >= expiresIn.
		{
			signingDate: new Date(
				Math.floor(Date.now() / (expiresIn * 1000)) * expiresIn * 1000,
			),
			expiresIn: expiresIn * 2,
		},
	);
}

/** Server-side upload of bytes the backend already checked (user skills). */
export async function putFile(key: string, bytes: Uint8Array, type: string) {
	const { PutObjectCommand } = await sdk();
	await (await s3()).send(
		new PutObjectCommand({
			Bucket: config().bucket,
			Key: key,
			Body: bytes,
			ContentType: type,
		}),
	);
}

/** A small text object, read on the server (a skill's SKILL.md). */
export async function getText(key: string) {
	const { GetObjectCommand } = await sdk();
	const res = await (await s3()).send(
		new GetObjectCommand({ Bucket: config().bucket, Key: key }),
	);
	return (await res.Body?.transformToString("utf-8")) ?? "";
}
