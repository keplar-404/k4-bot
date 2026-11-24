"use client";

import type { Interaction, SessionView } from "eve/events";
import { openInteractions } from "eve/events";
import type { UseEveAgentReturn } from "eve/react";
import {
	ChevronRightIcon,
	LoaderCircleIcon,
	ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block";
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoiceDescription,
	QuestionnaireChoices,
	QuestionnaireDescription,
	QuestionnaireInput,
	QuestionnaireItem,
	QuestionnaireSubmit,
	QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import { api } from "@/lib/api";

type Answers = Parameters<UseEveAgentReturn["respond"]>[0];
// Rejects when eve refused the answer, so the card can be answered again.
type Answer = (answers: Answers) => Promise<unknown> | undefined;

// What the agent is waiting on (eve human-in-the-loop: approvals, questions, budget
// prompts, sign-ins), pinned above the prompt bar. eve owns the state: a request
// stays here until eve settles it.
export function OpenRequests({
	view,
	onAnswer,
}: {
	view: SessionView;
	onAnswer: Answer;
}) {
	const open = openInteractions(view);
	if (open.length === 0) return null;
	return (
		<div className="flex flex-col gap-2">
			{open.map((i) =>
				i.call?.name === "connect_app" ? (
					<ConnectApp key={i.interactionId} request={i} onAnswer={onAnswer} />
				) : i.request.kind === "approval" && i.request.options?.length ? (
					<Approval key={i.interactionId} request={i} onAnswer={onAnswer} />
				) : i.request.kind === "sign-in" ? (
					<SignIn key={i.interactionId} request={i} />
				) : (
					<Question key={i.interactionId} request={i} onAnswer={onAnswer} />
				),
			)}
		</div>
	);
}

// A tool call waiting for the user's OK: one click answers (no radio + Send). eve's
// text is "Approve <tool>?"; the call's input is shown, folded, so the user can check it.
function Approval({
	request: { interactionId, request, call },
	onAnswer,
}: {
	request: Interaction;
	onAnswer: Answer;
}) {
	const [sending, setSending] = useState<string>();
	const options = request.options ?? [];
	const action = (request.title ?? request.prompt)
		.replace(/^Approve\s+/i, "")
		.replace(/\?$/, "")
		.replace(/^Mcp\s+/i, ""); // custom connectors: "Mcp notes: …" -> "notes: …"
	const yes = (label: string) => /^(approve|allow|yes)/i.test(label);
	const input =
		call?.input != null && JSON.stringify(call.input) !== "{}"
			? JSON.stringify(call.input, null, 2)
			: null;
	return (
		<div className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-xs">
			<div className="flex items-start gap-3">
				<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<ShieldCheckIcon className="size-4" />
				</span>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<p className="text-sm font-medium">Allow this action?</p>
					<p className="truncate text-sm text-muted-foreground">{action}</p>
				</div>
			</div>
			{input && (
				<details className="group rounded-lg border bg-muted/40 text-xs">
					<summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-muted-foreground select-none hover:text-foreground">
						<ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" />
						Details
					</summary>
					<pre className="max-h-48 overflow-auto border-t px-3 py-2 font-mono whitespace-pre-wrap break-all">
						{input}
					</pre>
				</details>
			)}
			<div className="flex justify-end gap-2">
				{[...options]
					.sort((a, b) => Number(yes(a.label)) - Number(yes(b.label)))
					.map((o) => (
						<Button
							key={o.id}
							size="sm"
							variant={yes(o.label) ? "default" : "outline"}
							disabled={!!sending}
							onClick={() => {
								setSending(o.id);
								onAnswer([{ interactionId, optionId: o.id }])?.catch(() =>
									setSending(undefined),
								);
							}}
						>
							{sending === o.id && (
								<LoaderCircleIcon className="animate-spin" />
							)}
							{o.label}
						</Button>
					))}
			</div>
		</div>
	);
}

// Approvals, questions and budget prompts all carry a prompt and options, so one
// shadcn Questionnaire renders them. A typed answer goes as text when allowed.
function Question({
	request: { interactionId, request, call },
	onAnswer,
}: {
	request: Interaction;
	onAnswer: Answer;
}) {
	const options = request.options ?? [];
	const freeform = request.allowFreeform || options.length === 0;
	// The card stays until eve settles the request on the stream, which can lag;
	// meanwhile show that the answer is on its way and block a second send.
	const [sending, setSending] = useState(false);
	return (
		<Questionnaire
			className="rounded-lg border bg-card p-4"
			items={[
				{
					name: "answer",
					required: true,
					choices: options.map((o) => ({ value: o.id })),
				},
			]}
			onSubmit={(e) => {
				e.preventDefault();
				const value = String(new FormData(e.currentTarget).get("answer") ?? "");
				const picked = options.some((o) => o.id === value);
				if (sending) return;
				setSending(true);
				onAnswer([
					picked
						? { interactionId, optionId: value }
						: { interactionId, text: value },
				])?.catch(() => setSending(false));
			}}
		>
			<QuestionnaireItem name="answer" required>
				<QuestionnaireTitle>
					{request.title ?? request.prompt}
				</QuestionnaireTitle>
				{request.title && (
					<QuestionnaireDescription>{request.prompt}</QuestionnaireDescription>
				)}
				{/* eve's approval text is only "Approve <tool>?": show what the call would do. */}
				{call?.input != null && (
					<CodeBlock size="sm">
						<CodeBlockContent wrap className="max-h-64">
							{JSON.stringify(call.input, null, 2)}
						</CodeBlockContent>
					</CodeBlock>
				)}
				<QuestionnaireChoices>
					{options.map((o) => (
						<QuestionnaireChoice key={o.id} value={o.id}>
							{o.label}
							{o.description && (
								<QuestionnaireChoiceDescription>
									{o.description}
								</QuestionnaireChoiceDescription>
							)}
						</QuestionnaireChoice>
					))}
					{freeform && (
						<QuestionnaireInput
							aria-label="Your answer"
							placeholder="Type your answer…"
						/>
					)}
				</QuestionnaireChoices>
			</QuestionnaireItem>
			<QuestionnaireActions>
				<QuestionnaireSubmit disabled={sending}>
					{sending && <LoaderCircleIcon className="animate-spin" />}
					{sending ? "Sending…" : "Send"}
				</QuestionnaireSubmit>
			</QuestionnaireActions>
		</Questionnaire>
	);
}

// eve's sign-in for a connection: the user follows the link, eve resumes on its callback.
function SignIn({ request: { request } }: { request: Interaction }) {
	const s = request.signIn;
	return (
		<div className="flex items-center gap-3 rounded-lg border bg-card p-3">
			<p className="min-w-0 flex-1 text-sm">
				{s?.instructions ?? request.prompt}
			</p>
			{s?.url && (
				<Button
					size="sm"
					nativeButton={false}
					render={<a href={s.url} target="_blank" rel="noopener noreferrer" />}
				>
					Sign in
				</Button>
			)}
		</div>
	);
}

// The connect_app tool's question: the agent waits until the app is connected.
// Connect goes to Composio's page in this tab and back here; a card that finds the
// app connected answers "connected", and the tool checks again before it goes on.
function ConnectApp({
	request: { interactionId, call },
	onAnswer,
}: {
	request: Interaction;
	onAnswer: Answer;
}) {
	const slug = String(
		(call?.input as { app?: unknown } | undefined)?.app ?? "",
	);
	const [app, setApp] = useState<{
		name: string;
		logo: string | null;
		connected: boolean;
	}>();
	const [busy, setBusy] = useState(false);
	// One answer per request, even when React runs the check effect twice in dev.
	const answered = useRef(false);
	const answer = (optionId: "connected" | "cancel") => {
		if (answered.current) return;
		answered.current = true;
		onAnswer([{ interactionId, optionId }])?.catch(() => {
			answered.current = false; // refused: allow another try
		});
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: check once per request
	useEffect(() => {
		void api.api.me.apps[":slug"]
			.$get({ param: { slug } })
			.then(async (res) => {
				if (!res.ok) return;
				const a = await res.json();
				setApp(a);
				if (!a.connected) return;
				// The chat may still be resuming its stream (eve refuses answers until
				// then): try again for a few seconds.
				const tryAnswer = (left: number) => {
					answered.current = true;
					onAnswer([{ interactionId, optionId: "connected" }])?.catch(() => {
						answered.current = false;
						if (left > 0) setTimeout(() => tryAnswer(left - 1), 1000);
					});
				};
				if (!answered.current) tryAnswer(5);
			})
			.catch(() => {});
	}, [interactionId]);

	async function connect() {
		setBusy(true);
		const res = await api.api.me.apps[":slug"].connect
			.$post({ param: { slug }, json: { returnTo: window.location.pathname } })
			.catch(() => undefined);
		const link = res?.ok ? (await res.json()).url : null;
		if (link) window.location.href = link;
		else setBusy(false);
	}

	// Nothing until the check answers, and nothing once the app is connected: the agent
	// is about to continue, so a Connect card would only flash.
	if (!app || app.connected) return null;
	const name = app.name;
	return (
		<div className="flex items-center gap-3 rounded-lg border bg-card p-3">
			{app.logo && (
				// biome-ignore lint/performance/noImgElement: small remote app logo
				<img src={app.logo} alt="" className="size-8 shrink-0 rounded" />
			)}
			<p className="min-w-0 flex-1 text-sm">
				Connect {name} so the assistant can continue.
			</p>
			<Button size="sm" disabled={busy} onClick={() => void connect()}>
				Connect
			</Button>
			<Button size="sm" variant="outline" onClick={() => answer("cancel")}>
				Cancel
			</Button>
		</div>
	);
}
