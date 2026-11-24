"use client";

// The prompt bar's @ and / menus. Type @ (or press +) for tools and the user's apps;
// type / for modes, media and the user's skills. ↑↓ and Enter or Tab pick, Esc closes. One highlight
// glides to the active row. A picked app or command becomes a chip in the bar; on
// send, compose() turns the chips back into the same text as before
// ("@Gmail Search the web for …"), so the agent gets exactly what it got before.
import {
	AudioLinesIcon,
	BlocksIcon,
	GlobeIcon,
	ImageIcon,
	ListChecksIcon,
	MessageCircleQuestionIcon,
	MusicIcon,
	PaperclipIcon,
	SearchIcon,
	SparklesIcon,
	VideoIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type App = { slug: string; name: string; logo?: string; connected: boolean };
type Chip = { key: string; label: string; icon: React.ReactNode; text: string };
type Row = {
	key: string;
	name: string;
	desc: string;
	icon: React.ReactNode;
	run: () => void;
	section: string;
	app?: App;
};

// Shown with no search, so the menu opens with no loading. Composio serves every
// app's logo at logos.composio.dev/api/<slug>.
const COMMON: App[] = [
	["gmail", "Gmail"],
	["googlecalendar", "Google Calendar"],
	["googledrive", "Google Drive"],
	["googlesheets", "Google Sheets"],
	["googledocs", "Google Docs"],
	["slack", "Slack"],
	["notion", "Notion"],
	["github", "GitHub"],
	["linear", "Linear"],
	["outlook", "Outlook"],
].map(([slug, name]) => ({
	slug,
	name,
	logo: `https://logos.composio.dev/api/${slug}`,
	connected: false,
}));

type AppsQuery = { q?: string; cursor?: number; status?: "all" | "connected" };
type AppsPage = { connected: App[]; apps: App[]; cursor: number | null };
// Pages of GET /api/me/apps/all, kept for this page load: the @ menu and Settings
// share them, so typing the same search again (or reopening) asks nothing.
// clearApps() after a connect, disconnect or Refresh.
const pages = new Map<string, Promise<AppsPage>>();
export const clearApps = () => pages.clear();
export function getApps(
	{ q, cursor, status }: AppsQuery = {},
	refresh = false,
): Promise<AppsPage> {
	const key = JSON.stringify([
		q?.trim().toLowerCase() ?? "",
		cursor ?? 0,
		status ?? "all",
	]);
	if (refresh) pages.clear();
	let page = pages.get(key);
	if (!page) {
		page = api.api.me.apps.all
			.$get({
				query: {
					...(q?.trim() ? { q: q.trim() } : {}),
					...(cursor ? { cursor: String(cursor) } : {}),
					...(status ? { status } : {}),
					...(refresh ? { refresh: "1" as const } : {}),
				},
			})
			.then(async (r) => {
				if (!r.ok) throw new Error(String(r.status));
				return (await r.json()) as AppsPage;
			});
		pages.set(key, page);
		page.catch(() => pages.delete(key)); // failed: ask again next time
	}
	return page;
}

// The user's own skills (Settings > Skills), for the / menu. Loaded once per page
// load; clearSkills() after an upload or delete.
type Skill = { name: string; description: string };
let skillList: Promise<Skill[]> | undefined;
export const clearSkills = () => {
	skillList = undefined;
};
const getSkills = () => {
	skillList ??= api.api.me.skills
		.$get()
		.then(async (r) => (r.ok ? (await r.json()).skills : []))
		.catch(() => []);
	return skillList;
};

// The user's own MCP servers (Settings > Connectors), for the @ menu. Once per page
// load; clearMcp() after an add or delete.
export type McpServer = {
	name: string;
	host: string;
	logo: string | null;
	hasKey: boolean;
};
let mcpList: Promise<McpServer[]> | undefined;
export const clearMcp = () => {
	mcpList = undefined;
};
export const getMcp = () => {
	mcpList ??= api.api.me.mcp
		.$get()
		.then(async (r) => (r.ok ? (await r.json()).servers : []))
		.catch(() => []);
	return mcpList;
};

// The user's connected apps, for the @ menu.
const loadConnected = () =>
	getApps()
		.then((p) => p.connected)
		.catch(() => [] as App[]);

// One page of apps matching `q`; the backend searches its cached list, 20 at a time.
const searchApps = (q: string, cursor?: number) =>
	getApps({ q, cursor }).then(({ apps, cursor: next }) => ({
		apps,
		cursor: next,
	}));

const appIcon = (a: Pick<App, "logo">) =>
	a.logo ? (
		// biome-ignore lint/performance/noImgElement: tiny remote app logo
		<img src={a.logo} alt="" loading="lazy" className="size-4 rounded-sm" />
	) : (
		<BlocksIcon />
	);

/** The @word or /word being typed at the end of the draft. */
function tokenOf(draft: string) {
	const m = /(^|\s)([@/])([\w-]*)$/.exec(draft);
	return m
		? {
				kind: m[2] === "@" ? ("at" as const) : ("slash" as const),
				query: m[3].toLowerCase(),
				start: m.index + m[1].length,
			}
		: null;
}

export function usePromptMenu({
	draft,
	setDraft,
	focus,
	attach,
	setMode,
}: {
	draft: string;
	setDraft: (v: string) => void;
	focus: () => void;
	/** Opens the file picker; undefined while the chat can't take files yet. */
	attach?: () => void;
	setMode: (m: string) => void;
}) {
	const [plus, setPlus] = useState(false);
	const [dismissed, setDismissed] = useState(false);
	const [active, setActive] = useState(0);
	const [search, setSearch] = useState(""); // the menu's own box, when opened with +
	const [connected, setConnected] = useState<App[]>([]);
	const [found, setFound] = useState<{
		q: string;
		apps: App[];
		cursor: number | null;
		loading: boolean;
	}>({ q: "", apps: [], cursor: null, loading: false });
	const [chips, setChips] = useState<Chip[]>([]);
	const [skills, setSkills] = useState<Skill[]>([]);
	const [servers, setServers] = useState<McpServer[]>([]);
	const token = dismissed ? null : tokenOf(draft);
	const kind = plus ? "at" : token?.kind;
	const query = (plus ? search : (token?.query ?? "")).trim().toLowerCase();

	useEffect(() => {
		if (kind === "at") {
			void loadConnected().then(setConnected);
			void getMcp().then(setServers);
		}
		if (kind === "slash") void getSkills().then(setSkills);
	}, [kind]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: back to the first row when the list changes
	useEffect(() => setActive(0), [kind, query]);

	// Search after a short pause in typing; a newer search replaces an older one.
	useEffect(() => {
		if (kind !== "at" || !query) return;
		setFound({ q: query, apps: [], cursor: null, loading: true });
		const t = setTimeout(() => {
			searchApps(query)
				.then((r) =>
					setFound((f) =>
						f.q === query ? { q: query, ...r, loading: false } : f,
					),
				)
				.catch(() => setFound((f) => ({ ...f, loading: false })));
		}, 200);
		return () => clearTimeout(t);
	}, [kind, query]);
	// Scroll fires many times before state updates: one request per page, by ref.
	const asked = useRef("");
	const more = () => {
		if (found.loading || found.cursor === null) return;
		const { q, cursor } = found;
		if (asked.current === `${q}:${cursor}`) return;
		asked.current = `${q}:${cursor}`;
		setFound((f) => ({ ...f, loading: true }));
		searchApps(q, cursor)
			.then((r) =>
				setFound((f) =>
					f.q === q
						? {
								q,
								apps: [
									...f.apps,
									...r.apps.filter(
										(a) => !f.apps.some((x) => x.slug === a.slug),
									),
								],
								cursor: r.cursor,
								loading: false,
							}
						: f,
				),
			)
			.catch(() => setFound((f) => ({ ...f, loading: false })));
	};

	// Drop the typed token and close the menu.
	const done = () => {
		if (token) setDraft(draft.slice(0, token.start));
		setPlus(false);
		setSearch("");
		focus();
	};
	// Apps add up; a command replaces the previous command.
	const chip =
		(c: Chip, command = false) =>
		() => {
			setChips((cs) => [
				...cs.filter((x) => x.key !== c.key && !(command && x.key[0] === "/")),
				c,
			]);
			done();
		};
	const command = (
		key: string,
		label: string,
		icon: React.ReactNode,
		text: string,
	) => chip({ key, label, icon, text }, true);
	const mode = (m: string) => () => {
		setMode(m);
		done();
	};
	const appRow = (a: App): Row => ({
		key: a.slug,
		name: a.name,
		desc: a.connected ? "" : "Not connected yet",
		icon: appIcon(a),
		section: "Apps",
		app: a,
		run: chip({
			key: `@${a.slug}`,
			label: a.name,
			icon: appIcon(a),
			text: `@${a.name} `,
		}),
	});

	// The agent finds the server by its @name (its connection's description says it).
	const mcpRow = (m: McpServer): Row => ({
		key: `mcp:${m.name}`,
		name: m.name,
		desc: m.host,
		icon: appIcon({ logo: m.logo ?? undefined }),
		section: "Your servers",
		run: chip({
			key: `@mcp:${m.name}`,
			label: m.name,
			icon: appIcon({ logo: m.logo ?? undefined }),
			text: `@${m.name} `,
		}),
	});

	// No search: connected apps, then the common ones. A search: the backend's pages.
	const on = new Set(connected.map((a) => a.slug));
	const apps = query
		? found.q === query
			? found.apps
			: []
		: [...connected, ...COMMON.filter((a) => !on.has(a.slug))];
	const tools: Row[] = [
		{
			key: "attach",
			name: "Add photos & files",
			desc: attach ? "Upload from your device" : "Send a message first",
			icon: <PaperclipIcon />,
			section: "Tools",
			run: () => {
				done();
				attach?.();
			},
		},
		{
			key: "web",
			name: "Web search",
			desc: "Current news and info",
			icon: <GlobeIcon />,
			section: "Tools",
			run: command(
				"/search",
				"Web search",
				<GlobeIcon />,
				"Search the web for ",
			),
		},
	];
	// A skill stays in the text where it was typed ("… /blog-writer …"): the agent
	// loads the skill it names (agent/instructions/skills.ts).
	const skillRow = (k: Skill): Row => ({
		key: `skill:${k.name}`,
		name: `/${k.name}`,
		desc: k.description,
		icon: <SparklesIcon />,
		section: "Skills",
		run: () => {
			setDraft(`${draft.slice(0, token?.start ?? draft.length)}/${k.name} `);
			setPlus(false);
			focus();
		},
	});
	const slash = (
		key: string,
		desc: string,
		icon: React.ReactNode,
		section: string,
		run: () => void,
	): Row => ({ key, name: key, desc, icon, section, run });
	const rows: Row[] =
		kind === "at"
			? [
					...tools.filter((r) => r.name.toLowerCase().includes(query)),
					...servers.filter((m) => m.name.includes(query)).map(mcpRow),
					...apps.map(appRow),
				]
			: kind === "slash"
				? [
						slash(
							"/ask",
							"Ask before changing anything",
							<MessageCircleQuestionIcon />,
							"Modes",
							mode("ask"),
						),
						slash(
							"/plan",
							"Only plan, web reading only",
							<ListChecksIcon />,
							"Modes",
							mode("plan"),
						),
						slash(
							"/full",
							"Act without asking",
							<ZapIcon />,
							"Modes",
							mode("full"),
						),
						slash(
							"/search",
							"Search the web",
							<SearchIcon />,
							"Commands",
							command(
								"/search",
								"Web search",
								<GlobeIcon />,
								"Search the web for ",
							),
						),
						slash(
							"/image",
							"Make an image",
							<ImageIcon />,
							"Commands",
							command("/image", "Image", <ImageIcon />, "Make an image of "),
						),
						slash(
							"/video",
							"Make a short video (paid)",
							<VideoIcon />,
							"Commands",
							command(
								"/video",
								"Video",
								<VideoIcon />,
								"Make a short video of ",
							),
						),
						slash(
							"/music",
							"Make a song or clip",
							<MusicIcon />,
							"Commands",
							command("/music", "Music", <MusicIcon />, "Make music: "),
						),
						slash(
							"/speech",
							"Read text aloud as audio",
							<AudioLinesIcon />,
							"Commands",
							command(
								"/speech",
								"Speech",
								<AudioLinesIcon />,
								"Read this aloud: ",
							),
						),
						...skills.map(skillRow),
					].filter((r) => r.name.slice(1).toLowerCase().startsWith(query))
				: [];

	const close = () => {
		setPlus(false);
		setSearch("");
		setDismissed(true);
	};
	const removeChip = (key: string) => {
		setChips((cs) => cs.filter((c) => c.key !== key));
		focus();
	};

	/** Call first in the textarea's onKeyDown; true when the menu used the key. */
	function onKeyDown(e: React.KeyboardEvent) {
		// Backspace in an empty bar takes the last chip off.
		if (
			e.key === "Backspace" &&
			!draft &&
			!(plus && search) &&
			chips.length &&
			e.target instanceof HTMLTextAreaElement
		) {
			setChips((cs) => cs.slice(0, -1));
			return true;
		}
		if (!kind) return false;
		if (e.key === "Escape") {
			close();
			return true;
		}
		if (!rows.length) return false;
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			setActive(
				(i) =>
					(i + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length,
			);
			return true;
		}
		if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
			rows[active]?.run();
			return true;
		}
		return false;
	}

	// The Apps search box: in @ mode it edits the @word in the bar, after + its own text.
	const onSearch = (v: string) => {
		if (plus || !token) setSearch(v);
		else setDraft(`${draft.slice(0, token.start)}@${v.replace(/\s+/g, "-")}`);
	};

	return {
		open: !!kind,
		plus,
		chips,
		togglePlus: () => {
			setDismissed(false);
			setSearch("");
			setPlus((p) => {
				if (p) focus(); // closing: back to the bar
				return !p;
			});
		},
		/** Typing re-opens a menu Esc closed. */
		onType: () => {
			setDismissed(false);
			setPlus(false);
		},
		onKeyDown,
		/** The message text: app mentions, then the command, then what was typed. */
		compose: (text: string) =>
			[
				...chips.filter((c) => c.key[0] === "@"),
				...chips.filter((c) => c.key[0] === "/"),
			]
				.map((c) => c.text)
				.join("") + text,
		clearChips: () => setChips([]),
		chipList: chips.length ? (
			<ul aria-label="Added to this message" className="flex flex-wrap gap-1.5">
				{chips.map((c) => (
					<li
						key={c.key}
						className="flex h-6 animate-[pop-in_180ms_cubic-bezier(0.23,1,0.32,1)_both] items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 pr-0.5 pl-1.5 text-xs font-medium text-foreground [&_svg]:size-3.5 [&_svg]:text-primary"
					>
						{c.icon}
						{c.label}
						<button
							type="button"
							data-slot="chip-remove"
							aria-label={`Remove ${c.label}`}
							onClick={() => removeChip(c.key)}
							className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-primary/15 hover:text-foreground [&_svg]:size-3!"
						>
							<XIcon />
						</button>
					</li>
				))}
			</ul>
		) : null,
		menu: kind ? (
			<MenuList
				rows={rows}
				active={active}
				setActive={setActive}
				search={
					kind === "at" ? (
						<label className="relative mx-1 mb-1 flex items-center">
							<SearchIcon className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
							<input
								value={plus ? search : (token?.query ?? "")}
								onChange={(e) => onSearch(e.target.value)}
								onKeyDown={(e) => {
									if (onKeyDown(e)) e.preventDefault();
								}}
								onMouseDown={(e) => e.stopPropagation()}
								// Opened with +: type straight into the search.
								// biome-ignore lint/a11y/noAutofocus: the menu was just opened for this
								autoFocus={plus}
								placeholder="Search 1,800+ apps"
								aria-label="Search apps"
								className="h-8 w-full rounded-md border bg-transparent pr-2 pl-7 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
							/>
						</label>
					) : null
				}
				status={
					kind === "at" && query
						? found.loading
							? "Searching…"
							: found.q === query && !found.apps.length
								? `No apps match “${query}”`
								: undefined
						: undefined
				}
				onEnd={more}
				footer={
					kind === "at"
						? "Connected apps first. Search to find any other app"
						: "Type to search commands"
				}
				query={query}
			/>
		) : null,
	};
}

function MenuList({
	rows,
	active,
	setActive,
	search,
	status,
	onEnd,
	footer,
	query,
}: {
	rows: Row[];
	active: number;
	setActive: (i: number) => void;
	search: React.ReactNode;
	status?: string;
	onEnd: () => void;
	footer: string;
	query: string;
}) {
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const [box, setBox] = useState<{ top: number; height: number }>();
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the rows change (apps load in)
	useLayoutEffect(() => {
		const el = refs.current[active];
		el?.scrollIntoView({ block: "nearest" });
		setBox(el ? { top: el.offsetTop, height: el.offsetHeight } : undefined);
	}, [active, rows.length]);
	// The last rows in view load the next page.
	// biome-ignore lint/correctness/useExhaustiveDependencies: onEnd is new each render
	useEffect(() => {
		if (active >= rows.length - 3 && rows.length > 0) onEnd();
	}, [active, rows.length]);
	const [connecting, setConnecting] = useState<string>();

	async function connect(slug: string) {
		setConnecting(slug);
		const res = await api.api.me.apps[":slug"].connect
			.$post({ param: { slug }, json: { returnTo: window.location.pathname } })
			.catch(() => undefined);
		const url = res?.ok ? (await res.json()).url : null;
		if (url) window.location.href = url;
		else setConnecting(undefined);
	}

	return (
		<div
			role="listbox"
			aria-label="Suggestions"
			onScroll={(e) => {
				const el = e.currentTarget;
				if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) onEnd();
			}}
			className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-96 animate-[pop-in_180ms_cubic-bezier(0.23,1,0.32,1)_both] origin-bottom overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
		>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-x-1 rounded-md bg-accent transition-[top,height,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
				style={{
					top: box?.top ?? 0,
					height: box?.height ?? 0,
					opacity: box ? 1 : 0,
				}}
			/>
			{rows.map((r, i) => {
				const heading = r.section !== rows[i - 1]?.section;
				return (
					<div key={r.key}>
						{heading && (
							<div className={cn(i > 0 && "mt-1 border-t pt-1")}>
								<p className="px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
									{r.section}
								</p>
								{r.section === "Apps" && search}
							</div>
						)}
						<button
							type="button"
							role="option"
							// Not a bare <button>: globals.css dims those on hover.
							data-slot="prompt-menu-item"
							aria-selected={i === active}
							ref={(el) => {
								refs.current[i] = el;
							}}
							onMouseDown={(e) => e.preventDefault()} // keep the textarea focused
							onMouseEnter={() => setActive(i)}
							onClick={r.run}
							className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left [&_svg]:size-4"
						>
							<span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
								{r.icon}
							</span>
							<span className="shrink-0 text-sm font-medium">{r.name}</span>
							<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
								{r.desc}
							</span>
							{r.app &&
								(r.app.connected ? (
									<span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
										<span className="size-1.5 rounded-full bg-current" />
										Connected
									</span>
								) : (
									// biome-ignore lint/a11y/useSemanticElements: a <button> can't sit inside the row's <button>
									<span
										role="button"
										tabIndex={-1}
										onClick={(e) => {
											e.stopPropagation();
											if (r.app) void connect(r.app.slug);
										}}
										onKeyDown={() => {}}
										className={cn(
											"shrink-0 text-xs font-medium text-primary hover:underline",
											connecting === r.app.slug && "opacity-50",
										)}
									>
										{connecting === r.app.slug ? "Connecting…" : "Connect"}
									</span>
								))}
						</button>
					</div>
				);
			})}
			{/* Searching with no app rows yet: the Apps heading and box still show. */}
			{search && !rows.some((r) => r.section === "Apps") && (
				<div className={cn(rows.length > 0 && "mt-1 border-t pt-1")}>
					<p className="px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
						Apps
					</p>
					{search}
				</div>
			)}
			{status && (
				<p
					className={cn(
						"flex h-9 items-center px-2 text-xs text-muted-foreground",
						status === "Searching…" && "shimmer",
					)}
				>
					{status}
				</p>
			)}
			{!search && rows.length === 0 && (
				<p className="flex h-9 items-center px-2 text-xs text-muted-foreground">
					No matches for “{query}”
				</p>
			)}
			<p className="mt-1 border-t px-2 pt-1.5 pb-1 text-[11px] text-muted-foreground">
				{footer}
			</p>
		</div>
	);
}
