// Files between the agent's computer and R2. R2 holds what the agent gives the user
// (share_file: a download card, backend GET /api/files) and what the user attached;
// both live under their owner and chat (@repo/shared/files).
import {
	ALLOWED_FILE_TYPES,
	cleanFileName,
	fileKey,
	MAX_FILE_BYTES,
	ownsKey,
	typeOf,
} from "@repo/shared/files";
import {
	deleteFile,
	headFile,
	presignDownload,
	presignUpload,
} from "@repo/shared/r2";
import { chat } from "@repo/shared/schema";
import { and, eq } from "drizzle-orm";
import { onComputer } from "./computer";
import { appUserId, db } from "./db";

type Ctx = Parameters<typeof onComputer>[0] & { abortSignal?: AbortSignal };
export type SavedFile = {
	key: string;
	name: string;
	size: number;
	type: string;
};
type Failed = { error: string };

/** The user and chat this session belongs to (files live under that chat). */
async function chatOf(ctx: Ctx) {
	const userId = appUserId(ctx.session.auth.current);
	if (!userId) return null;
	const [own] = await db()
		.select({ id: chat.id })
		.from(chat)
		.where(and(eq(chat.eveSessionId, ctx.session.id), eq(chat.userId, userId)));
	return own ? { userId, chatId: own.id } : null;
}
// The web saves the session id in the background on the first turn.
const NOT_SAVED = {
	error: "This chat isn't saved yet. Try again in a moment.",
};

// The path arrives on stdin, never inside the command, so it can't inject shell.
const LOCATE = `read -r p
p=$(realpath -e -- "$p") || { echo "No such file." >&2; exit 3; }
case "$p" in "$HOME"/*|/home/shared/*|/tmp/*) ;; *) echo "Only files in your home, ~/Shared or /tmp can be shared." >&2; exit 4;; esac
[ -f "$p" ] || { echo "Not a file." >&2; exit 5; }
printf '%s\\n%s\\n' "$p" "$(stat -c %s -- "$p")"`;
const UPLOAD = `read -r p; read -r t; read -r u
curl -sfS -T "$p" -H "Content-Type: $t" "$u"`;

/** A file on the agent's computer, uploaded by the computer straight to R2. */
export async function fromComputer(
	ctx: Ctx,
	path: string,
): Promise<SavedFile | Failed> {
	const owner = await chatOf(ctx);
	if (!owner) return NOT_SAVED;
	const found = await onComputer(ctx, LOCATE, { stdin: path });
	if (found.exitCode !== 0) return { error: found.stderr.trim() };
	const [real, sizeText] = found.stdout.trim().split("\n");
	const type = typeOf(real);
	const size = Number(sizeText);
	const name = cleanFileName(real) ?? "file";
	if (size > MAX_FILE_BYTES)
		return { error: "Files over 100 MB can't be shared." };
	if (!ALLOWED_FILE_TYPES.has(type))
		return { error: `${type} files can't be shared.` };
	// The key keeps the path, so deleting the file in the app removes it here too.
	const key = fileKey(owner.userId, owner.chatId, real);
	// Signed for this exact size and type, for 60 s.
	const url = await presignUpload(key, { name, type, size });
	const sent = await onComputer(ctx, UPLOAD, {
		stdin: `${real}\n${type}\n${url}`,
		timeoutMs: 300_000,
		signal: ctx.abortSignal,
	});
	const landed = await headFile(key).catch(() => null);
	if (sent.exitCode !== 0 || landed?.size !== size || landed.type !== type) {
		await deleteFile(key).catch(() => {});
		return {
			error: `Upload failed: ${sent.stderr.trim() || "size or type changed"}`,
		};
	}
	return { key, name, size, type };
}

/** Bytes made by a media tool (an image, speech, a video), saved for the user. */
export async function saveBytes(
	ctx: Ctx,
	name: string,
	type: string,
	bytes: Uint8Array,
): Promise<SavedFile | Failed> {
	const owner = await chatOf(ctx);
	if (!owner) return NOT_SAVED;
	if (bytes.byteLength > MAX_FILE_BYTES)
		return { error: "The result is over 100 MB." };
	const key = fileKey(owner.userId, owner.chatId, name);
	const url = await presignUpload(key, { name, type, size: bytes.byteLength });
	const res = await fetch(url, {
		method: "PUT",
		headers: { "content-type": type },
		body: bytes.slice(), // an ArrayBuffer-backed copy, as fetch wants
		signal: AbortSignal.timeout(120_000),
	});
	if (!res.ok) return { error: `Saving the file failed (${res.status}).` };
	return { key, name, size: bytes.byteLength, type };
}

// Name and link arrive on stdin, never inside the command, so they can't inject shell.
const FETCH = `read -r d; read -r n; read -r u
mkdir -p "$HOME/$d" && curl -sfS -o "$HOME/$d/$n" "$u" && echo "$HOME/$d/$n"`;

/** A file in R2 copied onto the agent's computer, into ~/<folder>. */
export async function r2ToComputer(
	ctx: Ctx,
	key: string,
	name: string,
	folder: string,
): Promise<{ path: string } | Failed> {
	const url = await presignDownload(key, name, 60);
	const r = await onComputer(ctx, FETCH, {
		stdin: `${folder}\n${name}\n${url}`,
		timeoutMs: 300_000,
		signal: ctx.abortSignal,
	});
	return r.exitCode === 0
		? { path: r.stdout.trim() }
		: { error: `Copy to the computer failed: ${r.stderr.trim()}` };
}

/**
 * Bytes made by a media tool, saved on the agent's computer (not given to the user:
 * that is share_file's job). A command's output can't carry binary data, so the bytes
 * pass through a short-lived R2 object that is deleted right after.
 */
export async function toComputer(
	ctx: Ctx,
	name: string,
	type: string,
	bytes: Uint8Array,
): Promise<{ path: string } | Failed> {
	// A time prefix keeps two results with the same name apart.
	const unique = `${Date.now().toString(36)}-${name}`;
	const temp = await saveBytes(ctx, unique, type, bytes);
	if ("error" in temp) return temp;
	const copied = await r2ToComputer(ctx, temp.key, unique, "Media");
	await deleteFile(temp.key).catch(() => {});
	return copied;
}

// eve resends a fileUrl on every later model call, so it must last the session.
const SESSION_SECONDS = 7 * 24 * 60 * 60;

/** A link the model can read a file from: an attached file, or one on the computer. */
export async function viewLink(
	ctx: Ctx,
	{ path, fileId }: { path?: string; fileId?: string },
): Promise<(SavedFile & { url: string }) | Failed> {
	const userId = appUserId(ctx.session.auth.current);
	let file: SavedFile | Failed;
	if (fileId) {
		if (!userId || !ownsKey(userId, fileId)) return { error: "No such file." };
		const name = decodeURIComponent(fileId.split("/").pop() ?? "file");
		file = { key: fileId, name, ...(await headFile(fileId)) };
	} else if (path) file = await fromComputer(ctx, path);
	else return { error: "Give path or fileId." };
	if ("error" in file) return file;
	return {
		...file,
		url: await presignDownload(file.key, file.name, SESSION_SECONDS),
	};
}
