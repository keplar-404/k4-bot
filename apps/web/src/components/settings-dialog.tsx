"use client";

import { cn } from "cn";
import {
	BrainIcon,
	LayoutGridIcon,
	LogOutIcon,
	MonitorIcon,
	MoonIcon,
	PaletteIcon,
	RefreshCwIcon,
	SearchIcon,
	SettingsIcon,
	SunIcon,
	UserIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { clearApps, getApps } from "@/components/chat/prompt-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Glide } from "@/components/ui/glide";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useMemoryBusy } from "@/lib/chat-ui";

type User = { name: string; email: string; image?: string | null };

// Left: grouped sections and a filter. Right: the open section, as rows of label and
// control. Add a section to GROUPS and a case below.
const GROUPS = [
	{
		label: "You",
		items: [
			{ id: "account", label: "Account", icon: UserIcon },
			{ id: "appearance", label: "Appearance", icon: PaletteIcon },
		],
	},
	{
		label: "Assistant",
		items: [
			{ id: "memory", label: "Memory", icon: BrainIcon },
			{ id: "apps", label: "Connected apps", icon: LayoutGridIcon },
		],
	},
] as const;
export type Section = (typeof GROUPS)[number]["items"][number]["id"];

export function SettingsDialog({
	open,
	onOpenChange,
	user,
	onLogOut,
	start = "account",
}: {
	/** The section shown when it opens. */
	start?: Section;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user: User;
	onLogOut: () => void;
}) {
	const [section, setSection] = useState<Section>(start);
	// Each opening starts on the section it was opened for.
	useEffect(() => {
		if (open) setSection(start);
	}, [open, start]);
	const [filter, setFilter] = useState("");
	const groups = GROUPS.map((g) => ({
		...g,
		items: g.items.filter((i) =>
			i.label.toLowerCase().includes(filter.trim().toLowerCase()),
		),
	})).filter((g) => g.items.length);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[min(44rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
				<header className="flex h-14 shrink-0 items-center gap-2.5 border-b px-5">
					<span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<SettingsIcon className="size-4" />
					</span>
					<DialogTitle className="text-base">Settings</DialogTitle>
				</header>
				<div className="flex min-h-0 flex-1 flex-col md:flex-row">
					<nav
						aria-label="Settings sections"
						className="flex shrink-0 flex-col gap-3 border-b bg-muted/30 p-3 md:w-60 md:border-r md:border-b-0"
					>
						<div className="relative">
							<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={filter}
								onChange={(e) => setFilter(e.target.value)}
								placeholder="Find a setting"
								aria-label="Find a setting"
								className="h-9 pl-8"
							/>
						</div>
						<div className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
							<Glide items="[data-glide-item]" />
							{groups.map((g, i) => (
								<Fragment key={g.label}>
									{i > 0 && <Separator className="my-2 hidden md:block" />}
									<p className="hidden px-2.5 pt-1 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase md:block">
										{g.label}
									</p>
									{g.items.map((s) => (
										<button
											key={s.id}
											type="button"
											data-glide-item
											aria-current={section === s.id ? "page" : undefined}
											onClick={() => setSection(s.id)}
											className={cn(
												"flex h-9 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4",
												section === s.id &&
													"bg-background font-medium text-foreground shadow-xs ring-1 ring-border",
											)}
										>
											<s.icon />
											{s.label}
										</button>
									))}
								</Fragment>
							))}
							{groups.length === 0 && (
								<p className="px-2.5 py-2 text-sm text-muted-foreground">
									Nothing matches “{filter}”.
								</p>
							)}
						</div>
					</nav>
					<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-5 md:p-8">
						{open && section === "account" && (
							<AccountSettings user={user} onLogOut={onLogOut} />
						)}
						{open && section === "appearance" && <AppearanceSettings />}
						{open && section === "memory" && <MemorySettings />}
						{open && section === "apps" && <AppsSettings />}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// A section's title, its description and (right) its main action.
function SectionHead({
	title,
	children,
	action,
}: {
	title: string;
	children: React.ReactNode;
	action?: React.ReactNode;
}) {
	return (
		<div className="mb-5 flex items-start justify-between gap-4 pr-6">
			<div className="flex flex-col gap-1">
				<h3 className="font-heading text-lg font-semibold">{title}</h3>
				<DialogDescription>{children}</DialogDescription>
			</div>
			{action}
		</div>
	);
}

// Rows of label (left) and value or control (right), in one bordered card.
function Rows({ children }: { children: React.ReactNode }) {
	return (
		<div className="divide-y rounded-xl border bg-card text-card-foreground">
			{children}
		</div>
	);
}
function Row({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3.5">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-sm font-medium">{label}</span>
				{hint && <span className="text-xs text-muted-foreground">{hint}</span>}
			</div>
			{children}
		</div>
	);
}

function AccountSettings({
	user,
	onLogOut,
}: {
	user: User;
	onLogOut: () => void;
}) {
	const initials = user.name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	return (
		<>
			<SectionHead title="Account">Who you're signed in as.</SectionHead>
			<div className="mb-4 flex items-center gap-4 rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-4">
				<Avatar className="size-14">
					<AvatarImage
						src={user.image ?? undefined}
						alt={user.name}
						// Google profile photos refuse requests that send a referrer.
						referrerPolicy="no-referrer"
					/>
					<AvatarFallback className="text-base">{initials}</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<p className="truncate font-medium">{user.name}</p>
					<p className="truncate text-sm text-muted-foreground">{user.email}</p>
				</div>
			</div>
			<Rows>
				<Row label="Full name">
					<span className="text-sm text-muted-foreground">{user.name}</span>
				</Row>
				<Row label="Email" hint="The address you sign in with">
					<span className="text-sm text-muted-foreground">{user.email}</span>
				</Row>
				<Row
					label="Log out"
					hint="Also clears this browser's copy of your chats"
				>
					<Button variant="outline" size="sm" onClick={onLogOut}>
						<LogOutIcon />
						Log out
					</Button>
				</Row>
			</Rows>
		</>
	);
}

const THEMES = [
	{ id: "light", label: "Light", icon: SunIcon },
	{ id: "dark", label: "Dark", icon: MoonIcon },
	{ id: "system", label: "System", icon: MonitorIcon },
] as const;

// Each choice shows a small picture of the app in that theme.
function AppearanceSettings() {
	const { theme = "system", setTheme } = useTheme();
	return (
		<>
			<SectionHead title="Appearance">
				How the app looks on this device.
			</SectionHead>
			<Rows>
				<div className="flex flex-col gap-3 px-4 py-4">
					<span className="text-sm font-medium">Theme</span>
					<div
						role="radiogroup"
						aria-label="Theme"
						className="grid grid-cols-3 gap-3"
					>
						{THEMES.map((t) => (
							// biome-ignore lint/a11y/useSemanticElements: a card-sized radio, not a bare input
							<button
								key={t.id}
								type="button"
								role="radio"
								aria-checked={theme === t.id}
								onClick={() => setTheme(t.id)}
								className={cn(
									"flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors hover:bg-accent/50",
									theme === t.id && "border-primary ring-2 ring-primary/30",
								)}
							>
								<span
									aria-hidden
									className={cn(
										"flex h-16 overflow-hidden rounded-md border",
										t.id === "light" && "bg-white",
										t.id === "dark" && "bg-neutral-900",
										t.id === "system" &&
											"bg-[linear-gradient(135deg,white_50%,var(--color-neutral-900)_50%)]",
									)}
								>
									<span
										className={cn(
											"w-1/4 border-r",
											t.id === "dark"
												? "border-white/10 bg-neutral-800"
												: "border-black/5 bg-neutral-100",
										)}
									/>
									<span className="flex flex-1 flex-col justify-end gap-1 p-1.5">
										<span className="h-1.5 w-2/3 rounded-full bg-primary/70" />
										<span
											className={cn(
												"h-1.5 w-1/2 rounded-full",
												t.id === "dark" ? "bg-white/20" : "bg-black/10",
											)}
										/>
									</span>
								</span>
								<span className="flex items-center gap-1.5 text-sm [&_svg]:size-3.5">
									<t.icon />
									{t.label}
								</span>
							</button>
						))}
					</div>
				</div>
			</Rows>
		</>
	);
}

// What the agent remembers about the user (agent_memory in Neon). Read-only
// until Edit; Save replaces it, and the agent uses the new text from its next turn.
function MemorySettings() {
	const [saved, setSaved] = useState<string>();
	const [draft, setDraft] = useState("");
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	// The limit comes from the backend, the one place it is defined.
	const [max, setMax] = useState<number>();
	const agentBusy = useMemoryBusy();

	// Loads again when the agent finishes a memory change, so Save starts from its result.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reload only when the agent finishes, not on every edit toggle
	useEffect(() => {
		if (agentBusy) return;
		void api.api.me.memory.$get().then(async (res) => {
			if (!res.ok) return toast.error("Could not load memory.");
			const { content, max } = await res.json();
			setMax(max);
			setSaved(content);
			setDraft((d) => (editing ? d : content));
		});
	}, [agentBusy]);

	async function save() {
		setSaving(true);
		const res = await api.api.me.memory
			.$put({ json: { content: draft } })
			.catch(() => undefined);
		setSaving(false);
		if (!res?.ok) return toast.error("Could not save memory. Try again.");
		const { content } = await res.json();
		setSaved(content);
		setDraft(content);
		setEditing(false);
		toast.success("Memory saved. The assistant uses it from its next reply.");
	}

	const facts = saved ? saved.split("\n").filter(Boolean).length : 0;
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<SectionHead
				title="Memory"
				action={
					!editing && (
						<Button
							variant="outline"
							size="sm"
							disabled={saved === undefined || agentBusy}
							onClick={() => setEditing(true)}
						>
							Edit
						</Button>
					)
				}
			>
				Preferences and facts the assistant has saved about you, one per line.
				It reads this at the start of every reply.
			</SectionHead>
			<div className="flex min-h-64 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
				<div className="flex h-10 shrink-0 items-center justify-between border-b px-4 text-xs text-muted-foreground">
					<span role="status">
						{agentBusy
							? "The assistant is updating memory…"
							: `${facts} ${facts === 1 ? "fact" : "facts"} saved`}
					</span>
					{editing && (
						<span className="tabular-nums">
							{draft.length.toLocaleString()} / {max?.toLocaleString()}
						</span>
					)}
				</div>
				<Textarea
					aria-label="Saved memory"
					readOnly={!editing}
					value={saved === undefined ? "Loading…" : draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder="Nothing saved yet. Tell the assistant your preferences in a chat, or click Edit to add them here."
					maxLength={max}
					className={cn(
						"min-h-0 flex-1 resize-none rounded-none border-0 [field-sizing:fixed] overflow-y-auto bg-transparent! font-mono text-sm shadow-none focus-visible:ring-0",
						!editing && "text-muted-foreground",
					)}
				/>
				{editing && (
					<div className="flex shrink-0 justify-end gap-2 border-t p-3">
						<Button
							variant="outline"
							size="sm"
							disabled={saving}
							onClick={() => {
								setDraft(saved ?? "");
								setEditing(false);
							}}
						>
							Cancel
						</Button>
						<Button
							size="sm"
							disabled={saving || agentBusy || draft === saved}
							onClick={save}
						>
							{saving ? "Saving…" : "Save"}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

type App = { slug: string; name: string; logo?: string; connected: boolean };
type Status = "all" | "connected";
const STATUSES: { id: Status; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "connected", label: "Connected" },
];

// The user's apps, the same ones the assistant uses in chat. Search and filter run
// on the backend's cached list (GET /api/me/apps/all), 20 at a time, never on Composio.
// Connecting goes to Composio's page and back here; Refresh re-reads connections.
function AppsSettings() {
	const [q, setQ] = useState("");
	const [status, setStatus] = useState<Status>("all");
	const [apps, setApps] = useState<App[]>();
	const [connected, setConnected] = useState<number>();
	const [cursor, setCursor] = useState<number | null>(null);
	const [busy, setBusy] = useState<string>();
	// A newer list replaces an older one still loading.
	const latest = useRef(0);

	async function load(next?: number, refresh = false) {
		const n = ++latest.current;
		const page = await getApps({ q, cursor: next, status }, refresh).catch(
			(e: Error) => e,
		);
		if (n !== latest.current) return;
		if (page instanceof Error)
			return toast.error(
				page.message === "429"
					? "Too many requests. Try again in a minute."
					: "Could not load apps.",
			);
		setApps((a) => (next ? [...(a ?? []), ...page.apps] : page.apps));
		setConnected(page.connected.length);
		setCursor(page.cursor);
	}
	// biome-ignore lint/correctness/useExhaustiveDependencies: reload when the search or filter changes
	useEffect(() => {
		const t = setTimeout(() => void load(), q ? 250 : 0);
		return () => clearTimeout(t);
	}, [q, status]);

	async function connect(slug: string) {
		setBusy(slug);
		const res = await api.api.me.apps[":slug"].connect
			.$post({ param: { slug }, json: { returnTo: window.location.pathname } })
			.catch(() => undefined);
		setBusy(undefined);
		const url = res?.ok ? (await res.json()).url : null;
		if (!url) return toast.error("Could not start connecting.");
		// Same tab: Composio sends the user back to this page when done.
		window.location.href = url;
	}

	async function disconnect(slug: string) {
		setBusy(slug);
		const res = await api.api.me.apps[":slug"]
			.$delete({ param: { slug } })
			.catch(() => undefined);
		setBusy(undefined);
		if (!res?.ok)
			return toast.error(
				res?.status === 429
					? "Too many changes. Try again in a minute."
					: "Could not disconnect.",
			);
		clearApps(); // the cached pages still show it connected
		setConnected((n) => (n ? n - 1 : n));
		setApps((a) =>
			status === "connected"
				? a?.filter((x) => x.slug !== slug)
				: a?.map((x) => (x.slug === slug ? { ...x, connected: false } : x)),
		);
	}

	const empty =
		status === "connected" && !q
			? "No apps connected yet."
			: q
				? `No apps match “${q}”.`
				: "No apps here.";
	return (
		<>
			<SectionHead
				title="Connected apps"
				action={
					<Button
						variant="outline"
						size="sm"
						onClick={() => void load(undefined, true)}
					>
						<RefreshCwIcon />
						Refresh
					</Button>
				}
			>
				Apps the assistant can use for you. You can also connect one when the
				assistant asks in a chat.
			</SectionHead>
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<div className="relative min-w-48 flex-1">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search 1,800+ apps"
						aria-label="Search apps"
						className="h-9 pl-8"
					/>
				</div>
				<div
					role="radiogroup"
					aria-label="Show"
					className="flex h-9 items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
				>
					{STATUSES.map((s) => (
						// biome-ignore lint/a11y/useSemanticElements: a segmented control
						<button
							key={s.id}
							type="button"
							role="radio"
							aria-checked={status === s.id}
							onClick={() => setStatus(s.id)}
							className={cn(
								"h-full rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
								status === s.id &&
									"bg-background text-foreground shadow-xs ring-1 ring-border",
							)}
						>
							{s.label}
							{s.id === "connected" && connected !== undefined && (
								<span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary tabular-nums">
									{connected}
								</span>
							)}
						</button>
					))}
				</div>
			</div>
			<Rows>
				{apps === undefined && (
					<p className="px-4 py-3.5 text-sm text-muted-foreground shimmer">
						Loading apps…
					</p>
				)}
				{apps?.length === 0 && (
					<p className="px-4 py-6 text-center text-sm text-muted-foreground">
						{empty}
					</p>
				)}
				{apps?.map((app) => (
					<div key={app.slug} className="flex items-center gap-3 px-4 py-2.5">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
							{/* biome-ignore lint/performance/noImgElement: tiny remote logo */}
							<img src={app.logo} alt="" loading="lazy" className="size-5" />
						</span>
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-sm font-medium">{app.name}</span>
							<span
								className={cn(
									"flex items-center gap-1.5 text-xs",
									app.connected
										? "text-emerald-600 dark:text-emerald-400"
										: "text-muted-foreground",
								)}
							>
								{app.connected && (
									<span className="size-1.5 rounded-full bg-current" />
								)}
								{app.connected ? "Connected" : "Not connected"}
							</span>
						</div>
						{app.connected ? (
							<Button
								variant="ghost"
								size="sm"
								className="text-muted-foreground hover:text-destructive"
								disabled={busy === app.slug}
								onClick={() => void disconnect(app.slug)}
							>
								Disconnect
							</Button>
						) : (
							<Button
								variant="outline"
								size="sm"
								disabled={busy === app.slug}
								onClick={() => void connect(app.slug)}
							>
								Connect
							</Button>
						)}
					</div>
				))}
			</Rows>
			{cursor !== null && (
				<Button
					variant="ghost"
					className="mt-3 self-center"
					onClick={() => void load(cursor)}
				>
					Show more apps
				</Button>
			)}
		</>
	);
}
