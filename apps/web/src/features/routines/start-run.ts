// Routines plug-in: "Run test". The backend makes the run's chat and record; this
// browser starts the agent session, saves its id on the run (so the agent knows the
// session is a routine run before it reads the first message), then sends the
// routine's instructions. The run then works like any chat.
import { Client } from "eve/client";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth-client";

export async function startTestRun(routineId: string) {
	const res = await api.api.routines[":id"].runs.$post({
		param: { id: routineId },
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { error?: string };
		throw new Error(body.error ?? "Could not start the run.");
	}
	const { runId, chatId, prompt } = (await res.json()) as {
		runId: string;
		chatId: string;
		prompt: string;
	};
	const client = new Client({
		baseUrl: window.location.origin,
		auth: { bearer: async () => (await getToken()) ?? "" },
	});
	const { session } = await client.sessions.create();
	const saved = await api.api.routines.runs[":id"].$patch({
		param: { id: runId },
		json: { sessionId: session.id },
	});
	if (!saved.ok) throw new Error("Could not save the run.");
	let model: string | null = null;
	try {
		model = localStorage.getItem("k4.model");
	} catch {}
	// Full mode: the run behaves as it will on schedule (drafts instead of prompts).
	await session.send(prompt, {
		clientContext: {
			mode: "full",
			tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
			...(model ? { model } : {}),
		},
	});
	return { chatId };
}
