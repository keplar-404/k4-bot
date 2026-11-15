// Desktop screenshots live in Neon Object Storage (S3 API, private bucket).
// Credentials, endpoint and region come from the AWS_* vars `neon env pull` writes.
// Path-style addressing is required by Neon.
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const Bucket = process.env.SCREENSHOT_BUCKET ?? "screenshots";
let client: S3Client | undefined;
const s3 = () => {
	client ??= new S3Client({ forcePathStyle: true });
	return client;
};

/** The object key; the first segment is the owner, so access checks are a prefix test. */
export const newScreenshotKey = (userId: string) =>
	`${userId}/${crypto.randomUUID()}.png`;

export async function putScreenshot(key: string, png: Uint8Array) {
	await s3().send(
		new PutObjectCommand({
			Bucket,
			Key: key,
			Body: png,
			ContentType: "image/png",
		}),
	);
}

export async function getScreenshot(key: string): Promise<Uint8Array> {
	const res = await s3().send(new GetObjectCommand({ Bucket, Key: key }));
	return (await res.Body?.transformToByteArray()) ?? new Uint8Array();
}

/** A short-lived link for the browser; the backend hands it out after an owner check. */
export const screenshotUrl = (key: string) =>
	getSignedUrl(s3(), new GetObjectCommand({ Bucket, Key: key }), {
		expiresIn: 300,
	});
