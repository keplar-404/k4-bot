"use client";

import {
	LoaderCircleIcon,
	MaximizeIcon,
	MousePointerClickIcon,
	PowerIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ToolRow } from "@/components/chat/messages";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
	useComputerBusy,
	useComputerSession,
	useComputerSteps,
} from "@/lib/chat-ui";

// The user's cloud computer, live (noVNC through the backend relay: backend
// src/computer.ts): this chat's agent desktop once its agent uses the computer, the
// user's own desktop before that. Mounted only while the right panel is open, so a
// closed panel makes no request and streams nothing. Watching is view-only; "Take
// control" gives the user the mouse and keyboard (captchas, sign-ins). "Stop" pauses
// the computer (free, everything kept); the panel or any agent resumes it.
export function ComputerPanel() {
	const [view, setView] = useState<{
		url: string;
		desktop: string;
		startedAt: string;
		session?: string;
	}>();
	const session = useComputerSession();
	const busy = useComputerBusy();
	const steps = useComputerSteps();
	const [error, setError] = useState(false);
	const [control, setControl] = useState(false);
	const [attempt, setAttempt] = useState(0);
	// Off until we know it's on: opening the tab must not start (and bill) the computer.
	const [paused, setPaused] = useState(true);
	const [expanded, setExpanded] = useState(false);
	const turnOn = () => {
		setPaused(false);
		setAttempt((a) => a + 1);
	};
	// Already on (the agent or another tab started it): show it straight away.
	// biome-ignore lint/correctness/useExhaustiveDependencies: once per mount
	useEffect(() => {
		api.api.me.computer.status
			.$get()
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => d?.on && turnOn())
			.catch(() => {});
	}, []);
	useEffect(() => {
		if (!expanded) return;
		const onKey = (e: KeyboardEvent) =>
			e.key === "Escape" && setExpanded(false);
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [expanded]);
	// Re-asks after the agent started: its desktop is made inside its first computer call.
	const retries = useRef(0);

	// A new chat never shows the previous chat's screen.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset when the chat changes
	useEffect(() => {
		setView(undefined);
		retries.current = 0;
	}, [session]);

	// Again when the chat changes, or its agent starts (it may have just made its desktop).
	// biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` and `busy` are triggers
	useEffect(() => {
		// Paused: fetching a view would resume it. An agent starting resumes it anyway.
		if (paused && !busy) return;
		if (paused) setPaused(false);
		// Already showing this chat's agent desktop: keep the stream, no new link.
		if (view?.desktop === "agent" && view.session === session) return;
		let live = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		setError(false);
		api.api.me.computer
			.$get({ query: session ? { session } : {} })
			.then(async (res) => {
				if (!res.ok) throw new Error(String(res.status));
				const next = await res.json();
				if (!live) return;
				// Same screen as shown: keep it, so the stream doesn't reload.
				setView((v) =>
					v?.desktop === next.desktop && v.session === session
						? v
						: { ...next, session },
				);
				// The agent's desktop may still be starting: ask again, 15 times at most.
				if (
					next.desktop === "yours" &&
					session &&
					(busy || retries.current > 0) &&
					retries.current < 15
				) {
					retries.current++;
					timer = setTimeout(() => setAttempt((a) => a + 1), 2000);
				}
			})
			.catch(() => live && setError(true));
		return () => {
			live = false;
			clearTimeout(timer);
		};
	}, [attempt, session, busy]);

	async function pause() {
		// Drop the stream first: E2B resumes a paused computer when traffic reaches it.
		setPaused(true);
		setControl(false);
		setView(undefined);
		const res = await api.api.me.computer.pause.$post().catch(() => undefined);
		if (!res?.ok) toast.error("Could not stop the computer. Try again.");
	}

	const url = view?.url;
	const src = url && (control ? url : `${url}&view_only=true`);
	const uptime = useUptime(url ? view?.startedAt : undefined);

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 p-3">
			{/* Expanding restyles this same element (fixed, over the page) instead of moving
			    it, so the iframe is never remounted and the stream never reconnects. */}
			<div
				aria-hidden
				onClick={() => setExpanded(false)}
				className={expanded ? "fixed inset-0 z-40 bg-black/60" : "hidden"}
			/>
			<section
				aria-label="Your computer"
				className={`flex flex-col overflow-hidden rounded-lg border bg-card ${expanded ? "fixed inset-4 z-50 shadow-2xl" : "shrink-0"}`}
			>
				<div className="flex h-9 shrink-0 items-center gap-2 border-b px-2 text-xs">
					<span
						className={`size-2 rounded-full ${url ? "bg-primary" : "bg-muted-foreground"}`}
						aria-hidden
					/>
					<span className="font-medium">
						{url ? "Live" : paused ? "Off" : "Starting"}
					</span>
					<span className="truncate text-muted-foreground">
						{view?.desktop === "agent" ? "Agent's desktop" : "Your desktop"}
					</span>
					<span className="ml-auto font-mono text-muted-foreground tabular-nums">
						{uptime}
					</span>
					<div className="-mr-1 flex [&>button]:size-6">
						<Button
							size="icon-sm"
							variant={control ? "default" : "ghost"}
							disabled={!url}
							aria-pressed={control}
							aria-label={control ? "Give control back" : "Take control"}
							title={control ? "Give control back" : "Take control"}
							onClick={() => setControl((c) => !c)}
						>
							<MousePointerClickIcon />
						</Button>
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label={paused ? "Turn on" : "Turn off"}
							title={paused ? "Turn on" : "Turn off"}
							onClick={paused ? turnOn : () => void pause()}
						>
							<PowerIcon />
						</Button>
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label={expanded ? "Close full view" : "Open full view"}
							title={expanded ? "Close full view" : "Open full view"}
							onClick={() => setExpanded((e) => !e)}
						>
							{expanded ? <XIcon /> : <MaximizeIcon />}
						</Button>
					</div>
				</div>
				<div
					className={`relative bg-muted/40 ${expanded ? "min-h-0 flex-1" : "aspect-[16/10] w-full"}`}
				>
					{paused ? (
						<div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
							Your computer is off. Nothing is billed; files are kept.
						</div>
					) : src ? (
						<iframe
							key={src}
							src={src}
							title="Your computer, live"
							className="size-full border-0"
							allow="clipboard-read; clipboard-write"
						/>
					) : error ? (
						<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
							<p>Couldn't start your computer.</p>
							<Button size="sm" variant="outline" onClick={turnOn}>
								Try again
							</Button>
						</div>
					) : (
						<div
							role="status"
							className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
						>
							<LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
							Starting your computer…
						</div>
					)}
				</div>
			</section>
			<p className="text-xs font-medium text-muted-foreground">
				Activity · computer steps
			</p>
			<div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto text-sm">
				{steps.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						No computer steps yet.
					</p>
				) : (
					steps.map((p) => <ToolRow key={p.callId} part={p} />)
				)}
			</div>
		</div>
	);
}

// How long the computer has been on, as HH:MM:SS.
// ponytail: wraps after 24 h; add days if computers run that long.
function useUptime(startedAt: string | undefined) {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);
	if (!startedAt) return "";
	return new Date(Math.max(0, now - Date.parse(startedAt)))
		.toISOString()
		.slice(11, 19);
}
