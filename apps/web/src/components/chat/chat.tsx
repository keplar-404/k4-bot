"use client";

import {
	defaultModelId,
	type Effort,
	models,
	visionModels,
} from "@repo/shared/models";
import { ClientError, type ClientSessionState } from "eve/client";
import { activeTurn, openInteractions } from "eve/events";
import {
	type EveToolPart,
	type UseEveAgentOptions,
	useEveAgent,
} from "eve/react";
import {
	ArrowUpIcon,
	LoaderCircleIcon,
	MessageCircleDashedIcon,
	MicIcon,
	PaperclipIcon,
	PlusIcon,
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
	VisionPicker,
} from "@/components/chat/pickers";
import { usePromptMenu } from "@/components/chat/prompt-menu";
import { startOrder } from "@/components/chat/split-turn";
import { useSubagents } from "@/components/chat/subagents";
import { useDictation } from "@/components/chat/voice";
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
	setComputerSteps,
	setMemoryBusy,
} from "@/lib/chat-ui";
import { modelIn, useOwnModels } from "@/lib/providers";

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
		followAgents: true, // helper agents' live work (subagents.tsx)
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
	useSubagents(agent);
	const [input, setInput] = useState("");
	// A `byok:` model is checked by the agent, which falls back to the free model when
	// it isn't in the catalog; the key check happens there too.
	const [model, setModel] = useStored(
		"k4.model",
		defaultModelId,
		(v) => v.startsWith("byok:") || models.some((m) => m.id === v),
	);
	const own = useOwnModels();
	const [effort, setEffort] = useState<Effort>();
	const [vision, setVision] = useStored("k4.vision", visionModels[0].id, (v) =>
		visionModels.some((m) => m.id === v),
	);
	const current = modelIn(own, model);
	const textOnly = current.vision === false;
	const [mode, setMode] = useStored("k4.mode", defaultMode, (v) =>
		MODES.includes(v),
	);
	const formRef = useRef<HTMLFormElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	// Bumped on each model change: replays the bar's rainbow sweep.
	const [sweep, setSweep] = useState(0);
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
			// No saved events yet: a session still on its first turn (a routine run).
			(!events?.length ||
				activeTurn(agent.view) ||
				openInteractions(agent.view).length > 0)
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
	// The mic types into the prompt bar, after what is already there.
	const voice = useDictation((text) =>
		setInput((v) => (v.trim() ? `${v.trimEnd()} ${text}` : text)),
	);
	const menu = usePromptMenu({
		draft: input,
		setDraft: setInput,
		focus: () => inputRef.current?.focus(),
		// Files go to this chat's agent, so the chat needs its session first.
		attach: agent.session ? () => fileRef.current?.click() : undefined,
		setMode,
	});
	// Tools running right now, in one pass: memory edits lock Settings > Memory,
	// computer tools open the Computer panel.
	// A question the agent asks after using the computer (a captcha or sign-in to do
	// by hand) opens the panel too.
	let savingMemory = false;
	let usingComputer = false;
	let usedComputer = false;
	let asking = false;
	const computerSteps: EveToolPart[] = [];
	for (const m of agent.messages)
		for (const p of m.parts) {
			if (p.type !== "tool") continue;
			const computer =
				p.name.startsWith("computer_") ||
				p.name === "browser" ||
				p.name === "app";
			if (computer) {
				usedComputer = true;
				computerSteps.push(p);
			}
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
	// One key per step and state, so the store only changes when a step does.
	const stepsKey = computerSteps.map((p) => p.callId + p.state).join();
	// biome-ignore lint/correctness/useExhaustiveDependencies: stepsKey stands for computerSteps
	useEffect(() => {
		setComputerSteps(computerSteps);
		return () => setComputerSteps([]);
	}, [stepsKey]);
	const eveSession = agent.session?.sessionId;
	useEffect(() => {
		setComputerSession(eveSession, chatIdRef.current);
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

	async function send(text: string, dead_ = dead, picked?: string[]) {
		if (!text.trim() || resuming) return;
		// Chips (apps, commands) go back to the text they stand for.
		const t = menu.compose(text.trim());
		const mcp = picked ?? menu.pickedMcp();
		menu.clearChips();
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
			// A model that can't take the file itself (text-only, or one of the user's
			// own models without PDF support) gets the id and calls view_file, where a
			// vision model reads it.
			const inline =
				!textOnly &&
				!(file?.type === "application/pdf" && current.pdf === false);
			const message =
				file?.read && file.type && inline
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
					: file && !inline
						? `${t}\n\n(Attached ${file.name}, file id \`${file.key}\`.)`
						: t;
			await agent.send(message, {
				clientContext: {
					model,
					reasoning: effort ?? null,
					mode,
					vision,
					// The user's time zone: the agent adds their local time to the message.
					tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
					...(mcp.length ? { mcp } : {}),
					...(reseed ? { reseed } : {}),
				},
			});
			if (file) setUpload(undefined);
		} catch (error) {
			// Found out only now that the session is gone: send again on a new one.
			if (!reseed && isDeadSession(error)) return send(t, true, mcp);
			setInput(t);
		}
	}

	return (
		<MessageScrollerProvider autoScroll>
			<div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col gap-2 px-3 pb-1.5 *:mx-auto *:w-full *:max-w-4xl sm:px-6">
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
									className="mx-auto max-w-4xl gap-6 pb-8"
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
								// Reopening a chat (back from connecting an app) resumes its stream
								// first, and eve refuses answers until then. The Connect card retries
								// by itself, so that one isn't a failure to show.
								if (!/resuming/.test(String((error as Error)?.message)))
									toast.error("Could not send your answer. Try again.");
								throw error; // the card re-enables its Send button
							})
						}
					/>
				)}

				<form
					ref={formRef}
					className="relative"
					onSubmit={(e) => {
						e.preventDefault();
						void send(input);
					}}
				>
					{menu.menu}
					<InputGroup className="isolate overflow-hidden rounded-xl bg-card shadow-md transition-[border-color,box-shadow] has-[[data-slot=input-group-control]:focus-visible]:ring-2 dark:bg-card">
						{sweep > 0 && (
							<span
								key={sweep}
								data-sweep
								aria-hidden
								className="pointer-events-none absolute inset-0 -z-10 animate-[sweep_900ms_cubic-bezier(0.16,1,0.3,1)_both] bg-[linear-gradient(90deg,transparent,oklch(0.72_0.19_25/0.6),oklch(0.8_0.17_85/0.6),oklch(0.75_0.18_150/0.6),oklch(0.7_0.15_240/0.6),oklch(0.65_0.2_300/0.6),transparent)]"
							/>
						)}
						{(upload || menu.chipList) && (
							<InputGroupAddon
								align="block-start"
								className="flex-wrap gap-1.5"
							>
								{menu.chipList}
								{upload && (
									<Attachment
										size="xs"
										state={upload.state}
										className="animate-[pop-in_200ms_cubic-bezier(0.23,1,0.32,1)_both]"
									>
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
								)}
							</InputGroupAddon>
						)}
						<InputGroupTextarea
							ref={inputRef}
							value={input}
							onChange={(e) => {
								setInput(e.target.value);
								menu.onType();
							}}
							placeholder={
								voice.state === "recording"
									? "Listening…"
									: running
										? "Steer the assistant…"
										: "Ask anything. @ for files and apps, / for commands"
							}
							aria-label="Message"
							aria-expanded={menu.open}
							disabled={resuming}
							className="max-h-40 min-h-14 text-base md:text-sm"
							onKeyDown={(e) => {
								if (menu.onKeyDown(e)) return e.preventDefault();
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
							{/* Files, web search and apps: the same menu as typing @. */}
							<InputGroupButton
								type="button"
								size="icon-sm"
								variant={menu.plus ? "secondary" : "ghost"}
								aria-label="Add files, web search and apps"
								aria-expanded={menu.plus}
								disabled={upload?.state === "uploading"}
								className="rounded-lg transition-transform active:scale-95"
								onClick={menu.togglePlus}
							>
								<PlusIcon
									className={
										menu.plus
											? "rotate-45 transition-transform"
											: "transition-transform"
									}
								/>
							</InputGroupButton>
							{voice.supported && (
								<InputGroupButton
									type="button"
									size="icon-sm"
									variant={voice.state === "recording" ? "default" : "ghost"}
									aria-pressed={voice.state === "recording"}
									disabled={voice.state === "working"}
									aria-label={
										voice.state === "recording"
											? "Stop and type what I said"
											: "Voice typing"
									}
									title={
										voice.state === "recording"
											? "Stop and type what I said"
											: "Voice typing"
									}
									onClick={voice.toggle}
								>
									{voice.state === "working" ? (
										<LoaderCircleIcon className="animate-spin" />
									) : voice.state === "recording" ? (
										<span
											aria-hidden
											className="flex h-3.5 items-center gap-0.5"
										>
											{[0, 150, 300].map((d) => (
												<span
													key={d}
													className="h-full w-0.5 animate-[eq-bounce_900ms_ease-in-out_infinite] rounded-full bg-current"
													style={{ animationDelay: `${d}ms` }}
												/>
											))}
										</span>
									) : (
										<MicIcon />
									)}
								</InputGroupButton>
							)}
							<ModelPicker
								model={model}
								effort={effort}
								onModel={(m) => {
									// The sparkle is for the flagship model only.
									if (m !== model && modelIn(own, m).flagship)
										setSweep((s) => s + 1);
									setModel(m);
									setEffort(undefined); // fall back to the new model's default
								}}
								onEffort={setEffort}
							/>
							{textOnly && <VisionPicker value={vision} onChange={setVision} />}
							<ModePicker value={mode} onChange={setMode} />
							{running && !input.trim() ? (
								<InputGroupButton
									type="button"
									size="icon-sm"
									variant="default"
									className="ml-auto rounded-lg transition-transform active:scale-95"
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
									className="ml-auto rounded-lg transition-transform enabled:active:scale-95"
									disabled={!input.trim() || resuming}
								>
									<ArrowUpIcon />
									<span className="sr-only">Send</span>
								</InputGroupButton>
							)}
						</InputGroupAddon>
					</InputGroup>
				</form>
				{/* A fixed slot, so the stats appearing never push the bar up. */}
				<div className="flex h-5 shrink-0 items-center justify-center">
					<ChatStats view={agent.view} contextWindow={current.contextWindow} />
				</div>
			</div>
		</MessageScrollerProvider>
	);
}
