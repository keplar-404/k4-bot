// This browser's copy of each saved chat (IndexedDB), so reopening one shows it at
// once and reads nothing from Neon: newer turns come from eve's stream, which resumes
// after the cached lines (eve docs: Resume a saved session). One user per browser:
// the cache is wiped when another user signs in or this one signs out.
// Every call fails soft: no IndexedDB (private mode, quota) just means no cache.
import type { ClientSessionState, SessionStreamEvent } from "eve/client";

export type CachedChat = {
	session: ClientSessionState;
	events: SessionStreamEvent[];
};

const OWNER = "__owner";

function request<T>(
	mode: IDBTransactionMode,
	op: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const open = indexedDB.open("k4-chats", 1);
		open.onupgradeneeded = () => open.result.createObjectStore("chats");
		open.onerror = () => reject(open.error);
		open.onsuccess = () => {
			const db = open.result;
			const tx = db.transaction("chats", mode);
			tx.oncomplete = tx.onabort = tx.onerror = () => db.close();
			const req = op(tx.objectStore("chats"));
			req.onsuccess = () => resolve(req.result as T);
			req.onerror = () => reject(req.error);
		};
	});
}

// Set by claimChatCache; every other call waits for it, so a chat page can never
// read the cache before another user's chats are wiped.
let claimed: Promise<unknown> | undefined;

async function run<T>(
	mode: IDBTransactionMode,
	op: (s: IDBObjectStore) => IDBRequest,
): Promise<T | undefined> {
	try {
		await claimed;
		return await request<T>(mode, op);
	} catch {
		return undefined;
	}
}

export const getCachedChat = (id: string) =>
	run<CachedChat>("readonly", (s) => s.get(id));

export const putCachedChat = (id: string, chat: CachedChat) =>
	run("readwrite", (s) => s.put(chat, id));

export const dropCachedChat = (id: string) =>
	run("readwrite", (s) => s.delete(id));

export const clearChatCache = () => run("readwrite", (s) => s.clear());

// The sidebar's chat list, kept beside the chats so it shows before the API answers.
const LIST = "__list";
export type CachedListItem = { id: string; title: string };
export const getCachedList = () =>
	run<CachedListItem[]>("readonly", (s) => s.get(LIST));
export const putCachedList = (list: CachedListItem[]) =>
	run("readwrite", (s) => s.put(list, LIST));

/** Wipes the cache when it belongs to someone else, then marks it as this user's. */
export function claimChatCache(userId: string) {
	const previous = claimed;
	claimed = (async () => {
		await previous;
		if ((await request<string>("readonly", (s) => s.get(OWNER))) === userId)
			return;
		await request("readwrite", (s) => s.clear());
		await request("readwrite", (s) => s.put(userId, OWNER));
	})().catch(() => undefined);
	return claimed;
}

/** The last stream line the cached events cover. */
export const lastLine = (events: SessionStreamEvent[]) =>
	events.reduce((max, e) => Math.max(max, e.meta.position.line), -1);

// Token deltas and tool-input/progress snapshots: eve rebuilds the same view from the
// completed events, so the cache skips them (most of a reply's events are deltas).
const PROGRESS = new Set(["content.delta", "call.input", "call.progress"]);
export const recorded = (events: readonly SessionStreamEvent[]) =>
	events.filter((e) => !PROGRESS.has(e.type));
