"use client";

// The prompt bar's mic: record with the browser's MediaRecorder, then on stop the
// backend has OpenRouter's Whisper turn it into text (backend transcribe.ts), which
// goes into the prompt bar to edit and send. Any language Whisper knows (99+).
// Reading replies aloud uses the browser's own speech (speechSynthesis).
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth-client";

/** Markdown read as plain words: no marks, links by their text, code skipped. */
const plain = (md: string) =>
	md
		.replace(/```[\s\S]*?```/g, " (code) ")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/[#*_`>|~]/g, "")
		.trim();

/** Reads text aloud; a second call (or stopSpeaking) replaces the first. */
export function speak(text: string, onEnd?: () => void) {
	speechSynthesis.cancel();
	const u = new SpeechSynthesisUtterance(plain(text));
	u.onend = () => onEnd?.();
	u.onerror = () => onEnd?.();
	speechSynthesis.speak(u);
}
export const stopSpeaking = () => speechSynthesis.cancel();

// Chrome and Firefox record webm, Safari mp4.
const TYPES = ["audio/webm", "audio/ogg", "audio/mp4"];

/** Record on the first toggle; on the second, transcribe and hand the text over. */
export function useDictation(onText: (text: string) => void) {
	// Known only in the browser: false during the server render, then checked.
	const [supported, setSupported] = useState(false);
	const [state, setState] = useState<"idle" | "recording" | "working">("idle");
	const rec = useRef<MediaRecorder>(undefined);
	useEffect(() => {
		setSupported("MediaRecorder" in window && !!navigator.mediaDevices);
	}, []);
	// Leaving the chat stops the mic.
	useEffect(
		() => () =>
			rec.current?.stream.getTracks().forEach((t) => {
				t.stop();
			}),
		[],
	);

	async function start() {
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			return toast.error("Allow the microphone to use voice typing.");
		}
		const r = new MediaRecorder(stream, {
			mimeType: TYPES.find((t) => MediaRecorder.isTypeSupported(t)),
		});
		const chunks: Blob[] = [];
		r.ondataavailable = (e) => chunks.push(e.data);
		r.onstop = async () => {
			stream.getTracks().forEach((t) => {
				t.stop();
			});
			setState("working");
			try {
				const res = await fetch(`${API_URL}/api/transcribe`, {
					method: "POST",
					headers: {
						authorization: `Bearer ${(await getToken()) ?? ""}`,
						"content-type": r.mimeType.split(";")[0],
					},
					body: new Blob(chunks),
				});
				const data = (await res.json()) as { text?: string; error?: string };
				if (!res.ok) toast.error(data.error ?? "Voice typing failed.");
				else if (data.text) onText(data.text);
			} catch {
				toast.error("Voice typing failed.");
			} finally {
				setState("idle");
			}
		};
		rec.current = r;
		r.start();
		setState("recording");
	}

	return {
		supported,
		state,
		toggle() {
			if (state === "recording") rec.current?.stop();
			else if (state === "idle") void start();
		},
	};
}
