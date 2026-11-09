"use client";

import { toast } from "sonner";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

/** The browser's speech recognition (Chrome, Edge, Safari), or null where there is none (Firefox). */
function recognition(): Recognition | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Dictation for the prompt: listens once (until the user pauses), then appends what was said to the draft. Speech is
 * processed by the browser; nothing goes to this app's server until the user sends the message.
 */
export function startDictation(
  onText: (text: string) => void,
  onEnd: () => void,
): (() => void) | null {
  const r = recognition();
  if (!r) {
    toast.error(
      "Voice input is not available in this browser. Try Chrome, Edge or Safari.",
    );
    onEnd();
    return null;
  }
  r.lang = navigator.language || "en-US";
  r.interimResults = false;
  r.continuous = false;
  r.onresult = (e) => {
    const text = Array.from(e.results)
      .map((result) => result[0]?.transcript ?? "")
      .join(" ")
      .trim();
    if (text) onText(text);
  };
  r.onerror = (e) => {
    if (e.error === "not-allowed")
      toast.error("Allow the microphone to use voice input.");
    else if (e.error !== "no-speech" && e.error !== "aborted")
      toast.error("Voice input stopped. Try again.");
  };
  r.onend = onEnd;
  r.start();
  return () => r.stop();
}
