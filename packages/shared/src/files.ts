// One file policy for the agent (share_file, media) and the backend (download, chat
// delete). Files live in R2 under their owner and chat: the key prefix is the owner
// check, so there is no file table.
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const FILE_URL_TTL_SECONDS = 5 * 60;

// Anything outside this list is refused before a URL is signed; octet-stream stays
// allowed for files that `file --mime-type` can't name.
export const ALLOWED_FILE_TYPES = new Set([
	"application/json",
	"application/msword",
	"application/octet-stream",
	"application/pdf",
	"application/vnd.ms-excel",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/xml",
	"application/zip",
	"audio/aac",
	"audio/flac",
	"audio/mpeg",
	"audio/mp4",
	"audio/ogg",
	"audio/wav",
	"audio/webm",
	"audio/x-m4a",
	"image/avif",
	"image/gif",
	"image/heic",
	"image/heif",
	"image/jpeg",
	"image/png",
	"image/svg+xml",
	"image/webp",
	"text/csv",
	"text/markdown",
	"text/plain",
	"video/mp4",
	"video/quicktime",
	"video/webm",
	"video/x-matroska",
]);

// Extension -> type, for files on the agent's computer (it has no `file` command, and
// its Python 3.10 doesn't know newer types such as .webp).
const TYPES: Record<string, string> = {
	json: "application/json",
	pdf: "application/pdf",
	xml: "application/xml",
	zip: "application/zip",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	aac: "audio/aac",
	flac: "audio/flac",
	mp3: "audio/mpeg",
	m4a: "audio/x-m4a",
	ogg: "audio/ogg",
	wav: "audio/wav",
	weba: "audio/webm",
	avif: "image/avif",
	gif: "image/gif",
	heic: "image/heic",
	heif: "image/heif",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	svg: "image/svg+xml",
	webp: "image/webp",
	csv: "text/csv",
	md: "text/markdown",
	txt: "text/plain",
	mp4: "video/mp4",
	mov: "video/quicktime",
	webm: "video/webm",
	mkv: "video/x-matroska",
};
/** A file's type from its name; unknown extensions are octet-stream. */
export const typeOf = (name: string) =>
	TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ??
	"application/octet-stream";

export type FileMetadata = { name: string; type: string; size: number };

/** Strip directories and control characters: `name` is only a display label. */
export function cleanFileName(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const name = value
		.split(/[\\/]/)
		.pop()
		?.replace(/\p{Cc}/gu, "")
		.trim();
	return name && name.length <= 255 ? name : null;
}

/** Where a chat's files live; deleting the chat deletes this prefix. */
export const chatPrefix = (userId: string, chatId: string) =>
	`u/${encodeURIComponent(userId)}/c/${encodeURIComponent(chatId)}/`;

/** Unguessable, and scoped to one user and one chat. */
export const fileKey = (userId: string, chatId: string, name: string) =>
	`${chatPrefix(userId, chatId)}${crypto.randomUUID()}/${encodeURIComponent(name)}`;

/** Only the owner's own keys, with no way to climb out of their prefix. */
export const ownsKey = (userId: string, key: string) =>
	key.startsWith(`u/${encodeURIComponent(userId)}/c/`) &&
	!key.includes("..") &&
	!key.includes("//");
