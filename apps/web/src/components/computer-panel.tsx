"use client";

import {
	LoaderCircleIcon,
	MonitorIcon,
	MousePointerClickIcon,
	PowerIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useComputerBusy, useComputerSession } from "@/lib/chat-ui";

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
		session?: string;
	}>();
	const session = useComputerSession();
	const busy = useComputerBusy();
	const [error, setError] = useState(false);
	const [control, setControl] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const [paused, setPaused] = useState(false);
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
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-sm">
				<MonitorIcon className="size-4 text-muted-foreground" aria-hidden />
				<span className="font-medium">
					{view?.desktop === "agent" ? "Agent's desktop" : "Your computer"}
				</span>
				{url && (
					<Button
						size="xs"
						variant={control ? "default" : "outline"}
						className="ml-auto"
						aria-pressed={control}
						onClick={() => setControl((c) => !c)}
					>
						<MousePointerClickIcon />
						{control ? "Stop control" : "Take control"}
					</Button>
				)}
				{!paused && (
					<Button
						size="xs"
						variant="outline"
						className={url ? undefined : "ml-auto"}
						onClick={() => void pause()}
					>
						<PowerIcon />
						Stop
					</Button>
				)}
			</div>
			{url && (
				<p className="shrink-0 border-b px-3 py-1.5 text-xs text-muted-foreground">
					{control
						? "You're in control. Solve the captcha or sign in, then click Stop control so the agent can continue."
						: "If the agent hits a captcha or a sign-in, click Take control and do that step yourself."}
				</p>
			)}
			<div className="relative min-h-0 flex-1 bg-muted/40">
				{paused ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
						<p className="max-w-xs text-muted-foreground">
							Your computer is stopped. Nothing is billed while it's stopped;
							your files, apps and logins are kept.
						</p>
						<Button
							size="sm"
							onClick={() => {
								setPaused(false);
								setAttempt((a) => a + 1);
							}}
						>
							<PowerIcon />
							Start computer
						</Button>
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
						<Button
							size="sm"
							variant="outline"
							onClick={() => setAttempt((a) => a + 1)}
						>
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
		</div>
	);
}
