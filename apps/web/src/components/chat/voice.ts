"use client";

// Voice mode with the browser's own speech (Web Speech API): no server, no model, no
// cost. Listening works in Chrome, Edge and Safari (Chrome sends the audio to Google
// to recognise it); speaking works everywhere. Without recognition the mic is hidden.
// ponytail: browser voices sound robotic; the media tool's TTS model is the upgrade.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Only what's used: TypeScript's DOM types have no SpeechRecognition constructor.
type Recognition = {
	lang: string;
	interimResults: boolean;
	continuous: boolean;
	start(): void;
	abort(): void;
	onresult:
		| ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
		| null;
	onerror: ((e: { error: string }) => void) | null;
	onend: (() => void) | null;
};
type Ctor = new () => Recognition;
const recognitionCtor = () => {
	const w = window as unknown as {
		SpeechRecognition?: Ctor;
		webkitSpeechRecognition?: Ctor;
	};
	return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

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

/**
 * Voice mode: listen, send what was said, read the reply aloud when the turn ends,
 * then listen again, until turned off. Silence just restarts listening.
 */
export function useVoice({
	busy,
	reply,
	onHeard,
}: {
	busy: boolean;
	/** The latest assistant reply, read when a turn ends. */
	reply?: string;
	onHeard: (text: string) => void;
}) {
	// Known only in the browser: false during the server render, then checked.
	const [supported, setSupported] = useState(false);
	const [on, setOn] = useState(false);
	const [listening, setListening] = useState(false);
	const live = useRef({ on: false, busy, onHeard });
	const rec = useRef<Recognition>(undefined);
	const wasBusy = useRef(busy);

	useEffect(() => {
		setSupported(!!recognitionCtor() && "speechSynthesis" in window);
	}, []);
	useEffect(() => {
		live.current.busy = busy;
		live.current.onHeard = onHeard;
	});

	function stop() {
		live.current.on = false;
		setOn(false);
		rec.current?.abort();
		stopSpeaking();
	}

	function listen() {
		const R = recognitionCtor();
		if (!R || !live.current.on) return;
		const r = new R();
		r.lang = navigator.language;
		r.interimResults = false;
		r.continuous = false;
		let heard = false;
		r.onresult = (e) => {
			const text = e.results[0]?.[0]?.transcript.trim();
			if (!text) return;
			heard = true;
			live.current.onHeard(text);
		};
		r.onerror = (e) => {
			// "no-speech" and "aborted" are normal; anything else (mic blocked, offline) stops.
			if (e.error === "no-speech" || e.error === "aborted") return;
			toast.error(
				e.error === "not-allowed"
					? "Allow the microphone to use voice mode."
					: `Voice mode stopped (${e.error}).`,
			);
			stop();
		};
		r.onend = () => {
			setListening(false);
			if (!heard && live.current.on && !live.current.busy) listen();
		};
		rec.current = r;
		r.start();
		setListening(true);
	}

	// A turn just ended: read its reply, then listen for the next message.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs on busy changes only
	useEffect(() => {
		const ended = wasBusy.current && !busy;
		wasBusy.current = busy;
		if (!ended || !live.current.on) return;
		if (reply) speak(reply, listen);
		else listen();
	}, [busy]);

	// Leaving the chat stops the mic and the voice.
	// biome-ignore lint/correctness/useExhaustiveDependencies: on unmount only
	useEffect(() => () => stop(), []);

	return {
		supported,
		on,
		listening,
		toggle() {
			if (live.current.on) return stop();
			live.current.on = true;
			setOn(true);
			listen();
		},
	};
}
