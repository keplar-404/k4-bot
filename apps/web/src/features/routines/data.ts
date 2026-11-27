// Routines plug-in: data for the sidebar group and the routine page.
// - In memory for the page's life, shared by every caller; asked again after FRESH_MS.
// - In IndexedDB per user, so a reload shows the last copy at once. Entries carry their
//   owner (the token's user id) and are ignored for anyone else.
// Every call fails soft: no IndexedDB just means no saved copy.
import { useEffect } from "react";
import { create } from "zustand";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth-client";

const FRESH_MS = 30_000;

type ListRes = Awaited<
	ReturnType<Awaited<ReturnType<typeof api.api.routines.$get>>["json"]>
>;
export type RoutineItem = ListRes["routines"][number];
type PageRes = Awaited<
	ReturnType<
		Awaited<ReturnType<(typeof api.api.routines)[":id"]["$get"]>>["json"]
	>
>;
export type RoutinePage = Extract<PageRes, { routine: unknown }>;

// ---- IndexedDB, keyed by owner ----
async function owner() {
	const token = await getToken();
	try {
		return token
			? (JSON.parse(
					atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
				).sub as string)
			: undefined;
	} catch {
		return undefined;
	}
}
function idb<T>(
	mode: IDBTransactionMode,
	op: (s: IDBObjectStore) => IDBRequest,
) {
	return new Promise<T>((resolve, reject) => {
		const open = indexedDB.open("k4-routines", 1);
		open.onupgradeneeded = () => open.result.createObjectStore("kv");
		open.onerror = () => reject(open.error);
		open.onsuccess = () => {
			const db = open.result;
			const tx = db.transaction("kv", mode);
			tx.oncomplete = tx.onabort = tx.onerror = () => db.close();
			const req = op(tx.objectStore("kv"));
			req.onsuccess = () => resolve(req.result as T);
			req.onerror = () => reject(req.error);
		};
	});
}
async function readSaved<T>(key: string): Promise<T | undefined> {
	try {
		const [me, hit] = await Promise.all([
			owner(),
			idb<{ owner: string; data: T } | undefined>("readonly", (s) =>
				s.get(key),
			),
		]);
		if (!hit || !me || hit.owner !== me) return undefined;
		return hit.data;
	} catch {
		return undefined;
	}
}
async function save(key: string, data: unknown) {
	try {
		const me = await owner();
		if (me) await idb("readwrite", (s) => s.put({ owner: me, data }, key));
	} catch {}
}

// ---- One zustand store: every screen reads the same copy, so a change shows everywhere ----
type Entry = { data?: unknown; at: number; error?: boolean };
const useStore = create<{ entries: Record<string, Entry> }>(() => ({
	entries: {},
}));
const put = (key: string, patch: Partial<Entry>) =>
	useStore.setState((s) => ({
		entries: {
			...s.entries,
			[key]: {
				...s.entries[key],
				...patch,
				at: patch.at ?? s.entries[key]?.at ?? 0,
			},
		},
	}));
const loading = new Map<string, Promise<void>>();

// A routine's fresh drafts count also updates its sidebar badge, without a request.
function syncBadge(key: string, data: unknown) {
	if (!key.startsWith("routine:")) return;
	const page = data as RoutinePage;
	const list = useStore.getState().entries.list?.data as ListRes | undefined;
	if (!list) return;
	put("list", {
		data: {
			routines: list.routines.map((r) =>
				r.id === page.routine.id
					? {
							...r,
							name: page.routine.name,
							enabled: page.routine.enabled,
							needs: page.stats.needsYou,
						}
					: r,
			),
		},
	});
}

function load<T>(key: string, fetcher: () => Promise<T>, force = false) {
	const e = useStore.getState().entries[key];
	if (loading.has(key) || (!force && e && Date.now() - e.at < FRESH_MS))
		return loading.get(key);
	if (e?.data === undefined)
		void readSaved<T>(key).then((saved) => {
			if (
				saved !== undefined &&
				useStore.getState().entries[key]?.data === undefined
			)
				put(key, { data: saved });
		});
	const p = fetcher()
		.then((data) => {
			put(key, { data, at: Date.now(), error: false });
			void save(key, data);
			syncBadge(key, data);
		})
		.catch(() => put(key, { error: true }))
		.finally(() => loading.delete(key));
	loading.set(key, p);
	return p;
}

function useEntry<T>(
	key: string | undefined,
	fetcher: () => Promise<T>,
	pollMs?: (data: T | undefined) => number | undefined,
) {
	const e = useStore((s) => (key ? s.entries[key] : undefined));
	const data = e?.data as T | undefined;
	const every = pollMs?.(data);
	// biome-ignore lint/correctness/useExhaustiveDependencies: one load per key; refresh on focus
	useEffect(() => {
		if (!key) return;
		void load(key, fetcher);
		const onFocus = () => void load(key, fetcher);
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [key]);
	// While something is happening (a run going), ask again every few seconds.
	// biome-ignore lint/correctness/useExhaustiveDependencies: restart only when the rate changes
	useEffect(() => {
		if (!key || !every) return;
		const t = setInterval(() => {
			if (document.visibilityState === "visible") void load(key, fetcher, true);
		}, every);
		return () => clearInterval(t);
	}, [key, every]);
	return { data, error: e?.error === true && data === undefined };
}

const json = async <T>(res: Response) => {
	if (!res.ok) throw new Error(String(res.status));
	return (await res.json()) as T;
};
const fetchList = () => api.api.routines.$get().then((r) => json<ListRes>(r));
const fetchPage = (id: string) =>
	api.api.routines[":id"]
		.$get({ param: { id } })
		.then((r) => json<RoutinePage>(r));

// The sidebar list: no polling (it would keep Neon awake). Fresh on load, on tab focus
// (at most every 30 s), after any change here, and its badges follow every routine
// page fetch (syncBadge) at no cost.
export const useRoutines = () => useEntry("list", fetchList);
// A routine: every 4 s only while a run is going or just ended (its notes are saved in a
// follow-up turn), and only while the tab is visible. Otherwise: no requests.
const LIVE_MS = 90_000;
export const useRoutine = (id: string | undefined) =>
	useEntry(
		id ? `routine:${id}` : undefined,
		() => fetchPage(id as string),
		(d) =>
			d?.runs.some(
				(r) =>
					r.status === "running" ||
					!r.endedAt ||
					Date.now() - new Date(r.endedAt).getTime() < LIVE_MS,
			)
				? 4_000
				: undefined,
	);

/** After a change: ask the backend again (list and that routine). */
export function refreshRoutines(id?: string) {
	void load("list", fetchList, true);
	if (id) void load(`routine:${id}`, () => fetchPage(id), true);
}

/** A routine was deleted: drop it from the store, the sidebar and this browser's copy. */
export function forgetRoutine(id: string) {
	const key = `routine:${id}`;
	useStore.setState((s) => {
		const { [key]: _, ...entries } = s.entries;
		const list = entries.list?.data as ListRes | undefined;
		if (list)
			entries.list = {
				...entries.list,
				data: { routines: list.routines.filter((r) => r.id !== id) },
			};
		return { entries };
	});
	void idb("readwrite", (s) => s.delete(key)).catch(() => {});
	void load("list", fetchList, true);
}
