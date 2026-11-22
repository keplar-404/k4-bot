"use client";

import { defaultModelId, type Effort, models } from "@repo/shared/models";
import { ClientError, type ClientSessionState } from "eve/client";
import { activeTurn, openInteractions } from "eve/events";
import { type UseEveAgentOptions, useEveAgent } from "eve/react";
import {
	ArrowUpIcon,
	MessageCircleDashedIcon,
	MicIcon,
	PaperclipIcon,
	SquareIcon,
	XIcon,
} from "lucide-react";
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
import { splitTurn, startOrder } from "@/components/chat/split-turn";
import { useVoice } from "@/components/chat/voice";
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentMedia,
	AttachmentTitle,
} from "@/components/ui/attachment";
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
	useMessageScrollerScrollable,
} from "@/components/ui/message-scroller";
import { api, notifyChatsChanged } from "@/lib/api";
import { getToken } from "@/lib/auth-client";
import { putCachedChat, recorded } from "@/lib/chat-cache";
import {
	setComputerBusy,
	setComputerSession,
	setMemoryBusy,
} from "@/lib/chat-ui";

const SUGGESTIONS = [
	"Search the web for this week's top AI news.",
	"What can you do?",
];

// Talks to the eve agent in apps/ai-agent through /eve/v1/* (see next.config.ts).
// Every request carries the user's Neon Auth token, which the agent checks.
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

// The session can't continue: missing from this World (404), deleted after it
// ended (410 session_expired), its deployment is gone (409 session_stranded), or
// a send found it ended or missing (409 session_not_active).
// The next message starts a new session instead of showing an error.
const DEAD = new Set([
	"session_expired",
	"session_stranded",
	"session_not_active",
]);
function isDeadSession(error: unknown) {
	if (ClientError.is(error) && error.status === 404) return true;
	const code = (error as { code?: unknown } | undefined)?.code;
	return typeof code === "string" && DEAD.has(code);
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

// Long chats draw only their newest messages; reaching the top (or the button, for
// keyboard users) adds older ones. eve still holds every event: this only limits
// rendering. The scroller keeps the reading position when older items are added.
const PAGE = 50;
function OlderMessages({
	hidden,
	onMore,
}: {
	hidden: number;
	onMore: () => void;
}) {
	const { start } = useMessageScrollerScrollable();
	// biome-ignore lint/correctness/useExhaustiveDependencies: load when the top is reached
	useEffect(() => {
		if (hidden > 0 && !start) onMore();
	}, [hidden, start]);
	if (hidden === 0) return null;
	return (
		<Button
			variant="outline"
			size="xs"
			className="absolute top-2 left-1/2 z-10 -translate-x-1/2"
			onClick={onMore}
		>
			Show {Math.min(hidden, PAGE)} earlier messages
		</Button>
	);
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
	const fileRef = useRef<HTMLInputElement>(null);
	const [upload, setUpload] = useState<{
		name: string;
		type?: string;
		key?: string;
		read?: string;
		state: "uploading" | "done" | "error";
	}>();

	// A file goes from this browser straight to R2 (backend POST /api/files/upload signs
	// a 60 s link for its exact size and type). The message carries the file itself, so
	// the model reads it, and its id, so the agent can copy it to its computer.
	async function attach(file: File) {
		const chatId = chatIdRef.current;
		if (!chatId) return;
		const type = file.type || "application/octet-stream";
		setUpload({ name: file.name, state: "uploading" });
		try {
			const res = await api.api.files.upload.$post({
				json: { chatId, name: file.name, type, size: file.size },
			});
			if (!res.ok) throw new Error(String(res.status));
			const { key, name, put, read } = await res.json();
			const sent = await fetch(put, {
				method: "PUT",
				headers: { "content-type": type },
				body: file,
			});
			if (!sent.ok) throw new Error(String(sent.status));
			setUpload({ name, type, key, read, state: "done" });
		} catch {
			setUpload({ name: file.name, state: "error" });
		}
	}

	const dead = isDeadSession(agent.error);
	// A dead session's resume can retry for a long time; the next send replaces
	// the session, so the composer stays usable.
	const resuming = agent.status === "resuming" && !dead;

	// The saved events already show the whole chat, so an idle chat makes no
	// request to eve when it opens (no stream, no retries on a dead session).
	// Only a turn still running or waiting on the user is resumed.
	// biome-ignore lint/correctness/useExhaustiveDependencies: once, on open
	useEffect(() => {
		if (
			sessionId &&
			(activeTurn(agent.view) || openInteractions(agent.view).length > 0)
		)
			void agent.resume().catch(() => {});
	}, []);
	// Real start order of every part, so parallel steps render as produced.
	const order = startOrder(agent.events);
	// Turns of earlier sessions of this chat, shown above the live one. The new
	// session repeats them as imported history; those copies are hidden.
	const [past, setPast] = useState<{
		messages: typeof agent.messages;
		order: typeof order;
	}>({ messages: [], order: new Map() });
	const live = past.messages.length
		? agent.messages.filter((m) => !m.metadata?.imported)
		: agent.messages;
	const empty = past.messages.length === 0 && live.length === 0;
	const [shown, setShown] = useState(PAGE);
	const rows = [
		// Each session numbers its turns from 0, so earlier sessions'
		// ids repeat: prefix them with their position.
		...past.messages.map((m, i) => [m, past.order, `p${i}:${m.id}`] as const),
		...live.map((m) => [m, order, m.id] as const),
	];
	const hidden = Math.max(0, rows.length - shown);
	const running = activeTurn(agent.view) !== undefined;
	const busy = agent.status === "busy" || running;
	const last = live.at(-1);
	const voice = useVoice({
		busy,
		reply: last?.role === "assistant" ? splitTurn(last.parts).reply : undefined,
		onHeard: (text) => void send(text),
	});
	// Tools running right now, in one pass: memory edits lock Settings > Memory,
	// computer tools open the Computer panel.
	// A question the agent asks after using the computer (a captcha or sign-in to do
	// by hand) opens the panel too.
	let savingMemory = false;
	let usingComputer = false;
	let usedComputer = false;
	let asking = false;
	for (const m of agent.messages)
		for (const p of m.parts) {
			if (p.type !== "tool") continue;
			const computer =
				p.name.startsWith("computer_") ||
				p.name === "browser" ||
				p.name === "app";
			if (computer) usedComputer = true;
			if (!RUNNING.has(p.state)) continue;
			if (p.name.startsWith("profile__")) savingMemory = true;
			if (computer) usingComputer = true;
			if (p.name === "ask_question") asking = true;
		}
	if (asking && usedComputer) usingComputer = true;
	useEffect(() => {
		setMemoryBusy(savingMemory);
		return () => setMemoryBusy(false);
	}, [savingMemory]);
	useEffect(() => {
		setComputerBusy(usingComputer);
		return () => setComputerBusy(false);
	}, [usingComputer]);
	const eveSession = agent.session?.sessionId;
	useEffect(() => {
		setComputerSession(eveSession);
		return () => setComputerSession(undefined);
	}, [eveSession]);

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

	async function send(text: string, dead_ = dead) {
		const t = text.trim();
		if (!t || resuming) return;
		setInput("");
		// The old session is gone: keep its turns on screen, start a new session, and
		// let the agent load the conversation from Neon for it.
		const reseed = dead_ && chatIdRef.current;
		if (reseed) {
			setPast({ messages: [...past.messages, ...live], order });
			agent.newSession();
		}
		if (!chatIdRef.current) {
			const res = await api.api.chats
				.$post({ json: { title: t.slice(0, 80) } })
				.catch(() => undefined);
			if (!res?.ok) return setInput(t); // offline too: keep what they typed
			const { id } = await res.json();
			chatIdRef.current = id;
			setUrl(`/dashboard/chat/${encodeURIComponent(id)}`);
			notifyChatsChanged();
		}
		// Sent while running, the message steers the current turn.
		try {
			// The agent finds an uploaded file on its computer by this path.
			const file = upload?.state === "done" ? upload : undefined;
			const message =
				file?.read && file.type
					? [
							{
								type: "text" as const,
								text: `${t}\n\n(Attached ${file.name}, file id \`${file.key}\`.)`,
							},
							{
								type: "file" as const,
								data: file.read,
								mediaType: file.type,
								filename: file.name,
							},
						]
					: t;
			await agent.send(message, {
				clientContext: {
					model,
					reasoning: effort ?? null,
					mode,
					...(reseed ? { reseed } : {}),
				},
			});
			if (file) setUpload(undefined);
		} catch (error) {
			// Found out only now that the session is gone: send again on a new one.
			if (!reseed && isDeadSession(error)) return send(t, true);
			setInput(t);
		}
	}

	return (
		<MessageScrollerProvider autoScroll>
			<div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col gap-2 px-3 pb-3 *:mx-auto *:w-full *:max-w-4xl sm:px-6 sm:pb-4">
				{/* full width so the empty side space scrolls the chat too */}
				<div className="min-h-0 flex-1 max-w-none!">
					{resuming && empty ? (
						<MessagesSkeleton />
					) : empty ? (
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
									{rows.slice(hidden).map(([m, o, key]) => (
										<MessageScrollerItem key={key} messageId={key}>
											{m.role === "user" ? (
												<UserMessage message={m} />
											) : (
												<AssistantMessage
													message={m}
													streaming={m.metadata?.status === "streaming"}
													order={o}
												/>
											)}
										</MessageScrollerItem>
									))}
									{busy && live.at(-1)?.role === "user" && (
										<MessageScrollerItem messageId="pending">
											<PendingAssistant />
										</MessageScrollerItem>
									)}
								</MessageScrollerContent>
							</MessageScrollerViewport>
							<OlderMessages
								hidden={hidden}
								onMore={() => setShown((n) => n + PAGE)}
							/>
							<MessageScrollerButton />
						</MessageScroller>
					)}
				</div>

				{!busy && !resuming && empty && (
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
				{agent.error && !busy && !dead && (
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
						{upload && (
							<InputGroupAddon align="block-start">
								<Attachment size="xs" state={upload.state}>
									<AttachmentMedia>
										<PaperclipIcon />
									</AttachmentMedia>
									<AttachmentContent>
										<AttachmentTitle>{upload.name}</AttachmentTitle>
										{upload.state === "error" && (
											<AttachmentDescription>
												Upload failed
											</AttachmentDescription>
										)}
									</AttachmentContent>
									<AttachmentActions>
										<AttachmentAction
											aria-label="Remove file"
											onClick={() => setUpload(undefined)}
										>
											<XIcon />
										</AttachmentAction>
									</AttachmentActions>
								</Attachment>
							</InputGroupAddon>
						)}
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
							{/* Files go to this chat's agent, so the chat needs its session first. */}
							{agent.session && (
								<>
									<input
										ref={fileRef}
										type="file"
										hidden
										onChange={(e) => {
											const f = e.target.files?.[0];
											e.target.value = "";
											if (f) void attach(f);
										}}
									/>
									<InputGroupButton
										type="button"
										size="icon-sm"
										variant="ghost"
										aria-label="Attach a file"
										disabled={upload?.state === "uploading"}
										onClick={() => fileRef.current?.click()}
									>
										<PaperclipIcon />
									</InputGroupButton>
								</>
							)}
							{voice.supported && (
								<InputGroupButton
									type="button"
									size="icon-sm"
									variant={voice.on ? "default" : "ghost"}
									aria-pressed={voice.on}
									aria-label={voice.on ? "Stop voice mode" : "Voice mode"}
									title={voice.on ? "Stop voice mode" : "Voice mode"}
									onClick={voice.toggle}
								>
									<MicIcon
										className={voice.listening ? "animate-pulse" : undefined}
									/>
								</InputGroupButton>
							)}
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
