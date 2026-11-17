"use client";

import { defaultModelId, type Effort, models } from "@repo/shared/models";
import type { ClientSessionState } from "eve/client";
import { activeTurn, openInteractions } from "eve/events";
import { type UseEveAgentOptions, useEveAgent } from "eve/react";
import { ArrowUpIcon, MessageCircleDashedIcon, SquareIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessagesSkeleton } from "@/components/chat/chat-skeleton";
import { ChatStats } from "@/components/chat/chat-stats";
import {
	AssistantMessage,
	PendingAssistant,
	RUNNING,
	UserMessage,
} from "@/components/chat/messages";
import { OpenRequests } from "@/components/chat/open-requests";
import {
	defaultMode,
	ModelPicker,
	ModePicker,
} from "@/components/chat/pickers";
import { startOrder } from "@/components/chat/split-turn";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { api, notifyChatsChanged } from "@/lib/api";
import { getToken } from "@/lib/auth-client";
import { putCachedChat, recorded } from "@/lib/chat-cache";
import { setMemoryBusy } from "@/lib/chat-ui";

const SUGGESTIONS = [
	"Search the web for this week's top AI news.",
	"What can you do?",
];

// Talks to the eve agent in apps/ai-agent through /eve/v1/* (see next.config.ts).
// The agent checks the Better Auth session cookie against apps/backend.
// Saved chats follow eve's Next.js guide: create the chat record before the
// first message, save the session id from onSessionChange, reopen with
// initialSession + resume, and switch the URL with History.replaceState.
// The chat only reopens if its session id is saved, so retry a few times.
// Change the address bar only. The native method, because Next patches
// window.history.replaceState to sync its router, and this must not navigate.
const setUrl = (path: string) =>
	History.prototype.replaceState.call(
		window.history,
		window.history.state,
		"",
		path,
	);

const MODES = ["ask", "plan", "full"];

// The last model/mode this browser picked. Read after mount (the server render has
// no localStorage); a stored value that is no longer allowed falls back to the default.
function useStored(key: string, initial: string, ok: (v: string) => boolean) {
	const [value, setValue] = useState(initial);
	// biome-ignore lint/correctness/useExhaustiveDependencies: read once per key on mount (`ok` is new each render)
	useEffect(() => {
		try {
			const saved = localStorage.getItem(key);
			if (saved && ok(saved)) setValue(saved);
		} catch {}
	}, [key]);
	const set = (v: string) => {
		setValue(v);
		try {
			localStorage.setItem(key, v);
		} catch {}
	};
	return [value, set] as const;
}

async function saveSession(id: string, eveSessionId: string) {
	for (let i = 0; i < 3; i++) {
		try {
			const res = await api.api.chats[":id"].$patch({
				param: { id },
				json: { eveSessionId },
			});
			if (res.ok) return true;
		} catch {}
		await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
	}
	return false;
}

export function Chat({
	chatId: savedChatId,
	sessionId,
	session,
	events,
}: {
	chatId?: string;
	sessionId?: string | null;
	/** eve's own cursor, as cached in this browser (eve docs: store `session` as given). */
	session?: ClientSessionState;
	/** Saved events of this session (backend GET /api/chats/:id), shown before catch-up. */
	events?: unknown[];
}) {
	const chatIdRef = useRef(savedChatId);
	const savedSessionRef = useRef(sessionId ?? undefined);
	const agent = useEveAgent({
		// The agent checks this token on every request; it is re-read each time.
		auth: { bearer: async () => (await getToken()) ?? "" },
		...(sessionId
			? {
					initialSession: session ?? { sessionId, streamIndex: 0 },
					initialEvents: events as UseEveAgentOptions["initialEvents"],
					resume: true,
				}
			: {}),
		// Follow the stream only while there is something to see: a turn running or
		// waiting on the user. An idle chat closes it (on Vercel an open stream is a
		// running function); eve reopens it on the next send, answer or resume.
		followWhile: (view) =>
			activeTurn(view) !== undefined || openInteractions(view).length > 0,
		onSessionChange: (session) => {
			const id = chatIdRef.current;
			const sid = session?.sessionId;
			if (!id || !sid || sid === savedSessionRef.current) return;
			savedSessionRef.current = sid;
			void saveSession(id, sid).then((ok) => {
				if (ok) return;
				savedSessionRef.current = undefined; // let the next change try again
				toast.error(
					"Could not save this chat. It may be missing from history.",
				);
			});
		},
	});
	const [input, setInput] = useState("");
	const [model, setModel] = useStored("k4.model", defaultModelId, (v) =>
		models.some((m) => m.id === v),
	);
	const [effort, setEffort] = useState<Effort>();
	const [mode, setMode] = useStored("k4.mode", defaultMode, (v) =>
		MODES.includes(v),
	);
	const formRef = useRef<HTMLFormElement>(null);

	const resuming = agent.status === "resuming";
	// Real start order of every part, so parallel steps render as produced.
	const order = startOrder(agent.events);
	const running = activeTurn(agent.view) !== undefined;
	const busy = agent.status === "busy" || running;
	const savingMemory = agent.messages.some((m) =>
		m.parts.some(
			(p) =>
				p.type === "tool" &&
				p.name.startsWith("profile__") &&
				RUNNING.has(p.state),
		),
	);
	useEffect(() => {
		setMemoryBusy(savingMemory);
		return () => setMemoryBusy(false);
	}, [savingMemory]);

	// Cache the chat in this browser whenever it settles (a turn done, or waiting on
	// the user), so reopening it reads nothing from Neon. Not while streaming.
	useEffect(() => {
		const id = chatIdRef.current;
		if (!id || !agent.session || agent.status !== "idle") return;
		void putCachedChat(id, {
			session: agent.session,
			events: recorded(agent.events),
		});
	}, [agent.status, agent.session, agent.events]);

	async function send(text: string) {
		const t = text.trim();
		if (!t || resuming) return;
		setInput("");
		if (!chatIdRef.current) {
			const res = await api.api.chats.$post({
				json: { title: t.slice(0, 80) },
			});
			if (!res.ok) return setInput(t);
			const { id } = await res.json();
			chatIdRef.current = id;
			setUrl(`/dashboard/chat/${encodeURIComponent(id)}`);
			notifyChatsChanged();
		}
		// Sent while running, the message steers the current turn.
		await agent.send(t, {
			clientContext: { model, reasoning: effort ?? null, mode },
		});
	}

	return (
		<MessageScrollerProvider autoScroll>
			<div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col gap-2 px-3 pb-3 *:mx-auto *:w-full *:max-w-4xl sm:px-6 sm:pb-4">
				{/* full width so the empty side space scrolls the chat too */}
				<div className="min-h-0 flex-1 max-w-none!">
					{resuming && agent.messages.length === 0 ? (
						<MessagesSkeleton />
					) : agent.messages.length === 0 ? (
						<Empty className="h-full">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<MessageCircleDashedIcon />
								</EmptyMedia>
								<EmptyTitle>What should we do?</EmptyTitle>
								<EmptyDescription>
									Pick a suggestion below or type your own message.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<MessageScroller>
							<MessageScrollerViewport className="scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
								<MessageScrollerContent
									aria-busy={busy}
									className="mx-auto max-w-4xl gap-6"
								>
									{agent.messages.map((m) => (
										<MessageScrollerItem key={m.id} messageId={m.id}>
											{m.role === "user" ? (
												<UserMessage message={m} />
											) : (
												<AssistantMessage
													message={m}
													streaming={m.metadata?.status === "streaming"}
													order={order}
												/>
											)}
										</MessageScrollerItem>
									))}
									{busy && agent.messages.at(-1)?.role === "user" && (
										<MessageScrollerItem messageId="pending">
											<PendingAssistant />
										</MessageScrollerItem>
									)}
								</MessageScrollerContent>
							</MessageScrollerViewport>
							<MessageScrollerButton />
						</MessageScroller>
					)}
				</div>

				{!busy && !resuming && agent.messages.length === 0 && (
					<div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
						{SUGGESTIONS.map((s) => (
							<Button
								key={s}
								variant="outline"
								size="sm"
								className="shrink-0"
								onClick={() => void send(s)}
							>
								{s}
							</Button>
						))}
					</div>
				)}

				{/* Next to the input, under the turn that failed, so it reads as that turn's result. */}
				{agent.error && !busy && (
					<p role="alert" className="text-sm text-destructive">
						{agent.error.message}
					</p>
				)}

				{/* What the agent is waiting on (eve human-in-the-loop), above the prompt bar. */}
				{/* Only once the stream has caught up: eve refuses answers while it resumes. */}
				{!resuming && (
					<OpenRequests
						view={agent.view}
						onAnswer={(answers) =>
							agent.respond(answers).catch((error: unknown) => {
								toast.error("Could not send your answer. Try again.");
								throw error; // the card re-enables its Send button
							})
						}
					/>
				)}

				<form
					ref={formRef}
					onSubmit={(e) => {
						e.preventDefault();
						void send(input);
					}}
				>
					<InputGroup>
						<InputGroupTextarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder={
								running ? "Steer the assistant…" : "Ask the assistant…"
							}
							aria-label="Message"
							disabled={resuming}
							className="max-h-40 min-h-14 text-base md:text-sm"
							onKeyDown={(e) => {
								if (
									e.key === "Enter" &&
									!e.shiftKey &&
									!e.nativeEvent.isComposing
								) {
									e.preventDefault();
									formRef.current?.requestSubmit();
								}
							}}
						/>
						<InputGroupAddon align="block-end" className="pt-1">
							<ModelPicker
								model={model}
								effort={effort}
								onModel={(m) => {
									setModel(m);
									setEffort(undefined); // fall back to the new model's default
								}}
								onEffort={setEffort}
							/>
							<ModePicker value={mode} onChange={setMode} />
							{running && !input.trim() ? (
								<InputGroupButton
									type="button"
									size="icon-sm"
									variant="default"
									className="ml-auto"
									onClick={() => void agent.cancel()}
								>
									<SquareIcon />
									<span className="sr-only">Stop</span>
								</InputGroupButton>
							) : (
								<InputGroupButton
									type="submit"
									size="icon-sm"
									variant="default"
									className="ml-auto"
									disabled={!input.trim() || resuming}
								>
									<ArrowUpIcon />
									<span className="sr-only">Send</span>
								</InputGroupButton>
							)}
						</InputGroupAddon>
					</InputGroup>
				</form>
				<ChatStats view={agent.view} />
			</div>
		</MessageScrollerProvider>
	);
}
