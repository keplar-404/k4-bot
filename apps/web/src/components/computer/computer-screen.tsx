"use client";

import { useEffect, useState } from "react";
import { viewerUrl } from "@/lib/computer/client";

/** The viewer link lives 15 minutes on the server; renew it a little before that. */
const RENEW_MS = 12 * 60_000;

/** True while the tab is visible: a hidden tab does not need a live video of the screen. */
function useTabVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * The live screen of the computer: noVNC in an iframe, served through our authenticated proxy.
 * `watch` is a view-only VNC server (the VM itself refuses input); `control` exists only while
 * the user holds the mouse and keyboard.
 */
export function ComputerScreen({
  mode,
  enabled,
  className,
  title = "Computer screen",
}: {
  mode: "watch" | "control";
  /** False while the computer is asleep: nothing is requested then. */
  enabled: boolean;
  className?: string;
  title?: string;
}) {
  const visible = useTabVisible();
  const active = enabled && visible;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
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
    const renew = setInterval(() => void mint(), RENEW_MS);
    return () => {
      cancelled = true;
      clearTimeout(retry);
      clearInterval(renew);
    };
  }, [active, mode]);

  if (!src) return null;
  return (
    <iframe
      key={mode}
      title={title}
      src={src}
      className={className}
      // The page is ours, but it is a remote desktop: no popups, no top navigation.
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
    />
  );
}
