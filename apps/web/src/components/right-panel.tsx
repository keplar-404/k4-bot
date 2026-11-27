"use client";

import { typeOf } from "@repo/shared/files";
import {
	ClockIcon,
	CompassIcon,
	FileIcon,
	FolderIcon,
	MonitorIcon,
	PlusIcon,
	SquareTerminalIcon,
	XIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileCard } from "@/components/chat/file-card";
import { ComputerPanel } from "@/components/computer-panel";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Glide } from "@/components/ui/glide";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	RoutineEditPanel,
	RoutineStartCard,
} from "@/features/routines/edit-panel";
import { API_URL, api } from "@/lib/api";
import { getToken } from "@/lib/auth-client";
import {
	closePanelTab,
	openPanelTab,
	setPanelTab,
	useChatId,
	useOpenFiles,
	usePanelTab,
	usePanelTabs,
} from "@/lib/chat-ui";

const TOOLS = {
	computer: {
		label: "Computer",
		hint: "Watch or drive your desktop",
		Icon: MonitorIcon,
		key: "d",
		shortcut: "Ctrl D",
	},
	files: {
		label: "Files",
		hint: "Everything uploaded or made in this chat",
		Icon: FolderIcon,
		key: "p",
		shortcut: "Ctrl P",
	},
	terminal: {
		label: "Terminal",
		hint: "Run commands on your computer",
		Icon: SquareTerminalIcon,
		key: "`",
		shortcut: "Ctrl `",
	},
} as const;
type Tool = keyof typeof TOOLS;
const TAB = {
	start: { label: "Start", Icon: CompassIcon },
	...TOOLS,
	// Routines plug-in: only opened by a routine run's chat.
	routine: { label: "Edit routine", Icon: ClockIcon },
};
// Browser only (react-doc-viewer docs: Next.js guide).
const FileViewer = dynamic(() => import("@/components/file-viewer"), {
	ssr: false,
});

// The right panel: tabs open on demand (Start's cards, shortcuts, +) and close with ×.
// Inactive tabs unmount (Base UI Tabs), so the computer streams and the terminal
// connects only while their tab is shown.
export function RightPanel() {
	const tabs = usePanelTabs();
	const openFiles = useOpenFiles();
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const hit = Object.entries(TOOLS).find(([, t]) => t.key === e.key);
			if (!hit || !(e.ctrlKey || e.metaKey)) return;
			e.preventDefault();
			openPanelTab(hit[0]);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	return (
		<Tabs
			value={usePanelTab()}
			onValueChange={(v) => setPanelTab(String(v))}
			className="h-full gap-0"
		>
			<div className="flex h-16 shrink-0 items-center gap-1 border-b px-2 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
				<TabsList className="h-8! min-w-0 justify-start overflow-x-auto bg-transparent p-0 [scrollbar-width:none]">
					{tabs.map((id) => {
						const { label, Icon } = openFiles[id]
							? { label: openFiles[id].name, Icon: FileIcon }
							: TAB[id as keyof typeof TAB];
						return (
							// The pill is the wrapper, so × sits inside it without reserving space.
							<span
								key={id}
								className="group/tab flex h-8 items-center rounded-md border border-transparent pr-1 has-data-active:border-border has-data-active:bg-muted"
							>
								<TabsTrigger
									value={id}
									className="flex-none border-0 bg-transparent! shadow-none! data-active:text-foreground/85!"
								>
									<Icon aria-hidden />
									<span className="max-w-32 truncate" title={label}>
										{label}
									</span>
								</TabsTrigger>
								<button
									type="button"
									aria-label={`Close ${label}`}
									onClick={() => closePanelTab(id)}
									className="invisible rounded p-0.5 text-muted-foreground group-hover/tab:visible group-has-data-active/tab:visible hover:bg-accent hover:text-foreground focus-visible:visible"
								>
									<XIcon className="size-3" />
								</button>
							</span>
						);
					})}
				</TabsList>
				<Button
					size="icon-sm"
					variant="ghost"
					aria-label="New tab"
					onClick={() => openPanelTab("start")}
				>
					<PlusIcon />
				</Button>
			</div>
			<TabsContent
				value="start"
				className="flex min-h-0 flex-col overflow-y-auto"
			>
				<div className="m-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-8">
					<Glide items="[data-glide-item]" className="rounded-xl" />
					<CompassIcon
						className="mb-6 size-12 text-muted-foreground/50"
						aria-hidden
					/>
					{Object.entries(TOOLS).map(
						([id, { label, hint, Icon, shortcut }]) => (
							<button
								key={id}
								type="button"
								data-glide-item
								onClick={() => openPanelTab(id)}
								className="flex w-full items-center gap-4 rounded-xl border bg-card px-5 py-4 text-left text-card-foreground transition-colors hover:bg-accent"
							>
								<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
									<Icon className="size-4" aria-hidden />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block font-medium">{label}</span>
									<span className="block text-xs text-muted-foreground">
										{hint}
									</span>
								</span>
								<Kbd className="font-mono">{shortcut}</Kbd>
							</button>
						),
					)}
					<RoutineStartCard />
				</div>
			</TabsContent>
			<TabsContent value="computer" className="min-h-0">
				<ComputerPanel />
			</TabsContent>
			<TabsContent value="files" className="min-h-0 overflow-y-auto p-3">
				<Files />
			</TabsContent>
			<TabsContent value="terminal" className="min-h-0">
				<Terminal />
			</TabsContent>
			<TabsContent
				value="routine"
				// The shell grows with its content: cap at the screen minus the panel header (and
				// the phone sheet's top bar) so this tab scrolls itself.
				className="max-h-[calc(100svh-7rem)] min-h-0 min-w-0 overflow-x-hidden overflow-y-auto md:max-h-[calc(100svh-4rem)]"
			>
				<RoutineEditPanel />
			</TabsContent>
			{Object.entries(openFiles).map(([id, file]) => (
				<TabsContent key={id} value={id} className="flex min-h-0 overflow-auto">
					<FileViewer file={file} />
				</TabsContent>
			))}
		</Tabs>
	);
}

type File = { key: string; name: string; size: number; at: string };

// This chat's files in R2: the user's uploads and what the agent shared.
// Kept for the page's life, per chat: reopening the tab shows the list at once, and R2
// is asked again only after FRESH_MS.
const FRESH_MS = 60_000;
const lists = new Map<string, { files: File[]; at: number }>();

function Files() {
	const chatId = useChatId();
	const [files, setFiles] = useState<File[]>();
	useEffect(() => {
		if (!chatId) return;
		const hit = lists.get(chatId);
		setFiles(hit?.files);
		if (hit && Date.now() - hit.at < FRESH_MS) return;
		api.api.files.list
			.$get({ query: { chatId } })
			.then((r) => (r.ok ? r.json() : Promise.reject()))
			.then((d) => {
				lists.set(chatId, { files: d.files, at: Date.now() });
				setFiles(d.files);
			})
			.catch(() => toast.error("Could not load files."));
	}, [chatId]);

	async function remove(key: string) {
		const r = await api.api.files.$delete({ query: { key } });
		if (!r.ok) return toast.error("Could not delete the file.");
		const left = files?.filter((x) => x.key !== key) ?? [];
		if (chatId) lists.set(chatId, { files: left, at: Date.now() });
		setFiles(left);
	}

	if (!chatId || files?.length === 0)
		return (
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderIcon />
					</EmptyMedia>
					<EmptyTitle>No files yet</EmptyTitle>
					<EmptyDescription>
						Files you attach and files the agent shares in this chat show here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	return (
		<div className="flex flex-col gap-2">
			{files?.map((f) => (
				<FileCard
					key={f.key}
					file={{ ...f, type: typeOf(f.name) }}
					onDelete={() => void remove(f.key)}
				/>
			))}
		</div>
	);
}

// xterm.js wired to the backend's terminal socket (apps/backend/src/terminal.ts).
// Loaded in the effect: xterm needs the DOM, so it can't run on the server.
// ponytail: size is fixed at connect; send pty resizes if users resize the panel a lot.
function Terminal() {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		let ws: WebSocket | undefined;
		let term: import("@xterm/xterm").Terminal | undefined;
		let gone = false;
		void (async () => {
			const [{ Terminal: Xterm }, { FitAddon }, { AttachAddon }] =
				await Promise.all([
					import("@xterm/xterm"),
					import("@xterm/addon-fit"),
					import("@xterm/addon-attach"),
					import("@xterm/xterm/css/xterm.css"),
				]);
			if (gone) return;
			// Colors from the theme (globals.css), so the terminal follows it.
			const css = getComputedStyle(el);
			term = new Xterm({
				cursorBlink: true,
				fontSize: 12,
				theme: { background: css.backgroundColor, foreground: css.color },
			});
			const fit = new FitAddon();
			term.loadAddon(fit);
			term.open(el);
			fit.fit();
			const t = term;
			ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/api/terminal`);
			ws.binaryType = "arraybuffer";
			ws.onopen = async () => {
				ws?.send(
					JSON.stringify({
						token: await getToken(),
						cols: t.cols,
						rows: t.rows,
					}),
				);
				if (ws) t.loadAddon(new AttachAddon(ws));
			};
			ws.onclose = () =>
				t.write("\r\n[disconnected: reopen the tab to reconnect]\r\n");
		})();
		return () => {
			gone = true;
			ws?.close();
			term?.dispose();
		};
	}, []);
	return <div ref={ref} className="h-full bg-background p-2 text-foreground" />;
}
