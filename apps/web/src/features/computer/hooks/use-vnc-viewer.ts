"use client";

import { useEffect, useRef } from "react";
import { BASE, viewerUrl } from "@/features/computer/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/** Shown if the viewer never reports its state (it always should): never hide a working screen for longer. */
const REVEAL_FALLBACK_MS = 10_000;

export type VncState = "connecting" | "reconnecting" | "connected";

/**
 * The live view's iframe URL (minted once per session and mode, retried until it works) and the connection state
 * the viewer page posts back.
 */
export function useVncViewer(enabled: boolean, mode: "watch" | "control") {
  const [{ src, state }, , store] = useLocalStore(() => ({
    src: null as string | null,
    state: "connecting" as VncState,
  }));
  const setSrc = fieldSetter(store, "src");
  const setState = fieldSetter(store, "state");
  const frameRef = useRef<HTMLIFrameElement>(null);
  /** The viewer page has reported its state at least once (then the fallback below never overrides it). */
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const mint = async () => {
      try {
        const url = await viewerUrl(mode);
        if (!cancelled) setSrc(url);
      } catch {
        if (!cancelled) retry = setTimeout(mint, 5000);
      }
    };
    void mint();
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [enabled, mode, setSrc]);

  // A new viewer (new session or mode) starts connecting again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the viewer URL changes
  useEffect(() => {
    setState("connecting");
    reportedRef.current = false;
    const reveal = setTimeout(() => {
      if (!reportedRef.current) setState("connected");
    }, REVEAL_FALLBACK_MS);
    return () => clearTimeout(reveal);
  }, [src]);

  // Only our own viewer page, in our own iframe, may report its state.
  useEffect(() => {
    const origin = new URL(BASE).origin;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; state?: VncState };
      if (
        event.origin !== origin ||
        event.source !== frameRef.current?.contentWindow ||
        data?.source !== "k4-vnc" ||
        !data.state
      )
        return;
      reportedRef.current = true;
      setState(data.state);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setState]);

  return { src, state, frameRef };
}
