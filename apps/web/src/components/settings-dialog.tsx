"use client";

import { cn } from "cn";
import { BrainIcon, LayoutGridIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useMemoryBusy } from "@/lib/chat-ui";

// Left: sections. Right: the open section. Add a section to SECTIONS and a case below.
const SECTIONS = [
	{ id: "memory", label: "Memory", icon: BrainIcon },
	{ id: "apps", label: "Connected apps", icon: LayoutGridIcon },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

export function SettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [section, setSection] = useState<Section>("memory");
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[min(42rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl md:flex-row">
				<nav
					aria-label="Settings sections"
					className="flex shrink-0 gap-1 border-b p-3 md:w-52 md:flex-col md:border-r md:border-b-0"
				>
					<DialogTitle className="hidden px-2 pb-2 md:block">
						Settings
					</DialogTitle>
					{SECTIONS.map((s) => (
						<Button
							key={s.id}
							variant="ghost"
							aria-current={section === s.id ? "page" : undefined}
							className={cn("justify-start", section === s.id && "bg-muted")}
							onClick={() => setSection(s.id)}
						>
							<s.icon />
							{s.label}
						</Button>
					))}
				</nav>
				<div className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
					{section === "memory" && open && <MemorySettings />}
					{section === "apps" && open && <AppsSettings />}
				</div>
			</DialogContent>
		</Dialog>
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

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="flex flex-col gap-1 pr-8">
				<h3 className="font-heading text-base font-medium">Memory</h3>
				<DialogDescription>
					Preferences and facts the assistant has saved about you, one per line.
					It reads this at the start of every reply.
				</DialogDescription>
			</div>
			<Textarea
				aria-label="Saved memory"
				readOnly={!editing}
				value={saved === undefined ? "Loading…" : draft}
				onChange={(e) => setDraft(e.target.value)}
				placeholder="Nothing saved yet. Tell the assistant your preferences in a chat, or click Edit to add them here."
				maxLength={max}
				className={cn(
					"min-h-0 flex-1 resize-none [field-sizing:fixed] overflow-y-auto font-mono text-sm",
					!editing && "bg-muted/40 text-muted-foreground",
				)}
			/>
			<div className="flex items-center justify-end gap-2">
				<span role="status" className="mr-auto text-xs text-muted-foreground">
					{agentBusy ? "The assistant is updating memory…" : ""}
				</span>
				{editing ? (
					<>
						<span className="text-xs text-muted-foreground">
							{draft.length.toLocaleString()} / {max?.toLocaleString()}
						</span>
						<Button
							variant="outline"
							disabled={saving}
							onClick={() => {
								setDraft(saved ?? "");
								setEditing(false);
							}}
						>
							Cancel
						</Button>
						<Button
							disabled={saving || agentBusy || draft === saved}
							onClick={save}
						>
							{saving ? "Saving…" : "Save"}
						</Button>
					</>
				) : (
					<Button
						variant="outline"
						disabled={saved === undefined || agentBusy}
						onClick={() => setEditing(true)}
					>
						Edit
					</Button>
				)}
			</div>
		</div>
	);
}

type App = { slug: string; name: string; logo?: string; connected: boolean };

// The user's Composio apps, the same ones the assistant uses in chat. Connecting goes to
// Composio's page and back to this page; Refresh reloads the list.
function AppsSettings() {
	const [apps, setApps] = useState<App[]>();
	const [cursor, setCursor] = useState<string | null>(null);
	const [busy, setBusy] = useState<string>();

	async function load(next?: string) {
		const res = await api.api.me.apps
			.$get({ query: next ? { cursor: next } : {} })
			.catch(() => undefined);
		if (!res?.ok) return toast.error("Could not load apps.");
		const page = await res.json();
		setApps((a) => (next ? [...(a ?? []), ...page.apps] : page.apps));
		setCursor(page.cursor);
	}
	// biome-ignore lint/correctness/useExhaustiveDependencies: load once when opened
	useEffect(() => {
		void load();
	}, []);

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
		if (!res?.ok) return toast.error("Could not disconnect.");
		setApps((a) =>
			a?.map((x) => (x.slug === slug ? { ...x, connected: false } : x)),
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="flex items-start justify-between gap-4 pr-8">
				<div className="flex flex-col gap-1">
					<h3 className="font-heading text-base font-medium">Connected apps</h3>
					<DialogDescription>
						Apps the assistant can use for you. You can also connect one when
						the assistant asks in a chat.
					</DialogDescription>
				</div>
				<Button variant="outline" size="sm" onClick={() => void load()}>
					Refresh
				</Button>
			</div>
			<ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
				{apps === undefined && (
					<li className="text-sm text-muted-foreground">Loading…</li>
				)}
				{apps?.map((app) => (
					<li
						key={app.slug}
						className="flex items-center gap-3 rounded-md border p-2"
					>
						{/* biome-ignore lint/performance/noImgElement: tiny remote logo */}
						<img src={app.logo} alt="" className="size-6 shrink-0" />
						<span className="min-w-0 flex-1 truncate text-sm">{app.name}</span>
						{app.connected ? (
							<Button
								variant="outline"
								size="sm"
								disabled={busy === app.slug}
								onClick={() => void disconnect(app.slug)}
							>
								Disconnect
							</Button>
						) : (
							<Button
								size="sm"
								disabled={busy === app.slug}
								onClick={() => void connect(app.slug)}
							>
								Connect
							</Button>
						)}
					</li>
				))}
			</ul>
			{cursor && (
				<Button variant="ghost" onClick={() => void load(cursor)}>
					Show more apps
				</Button>
			)}
		</div>
	);
}
