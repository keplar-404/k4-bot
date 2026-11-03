"use client";

import { Loader2Icon } from "lucide-react";
import { useVncViewer } from "@/features/computer/hooks/use-vnc-viewer";

/**
 * The live screen of the computer: noVNC in an iframe, served through our authenticated proxy.
 * `watch` is a view-only VNC server (the VM itself refuses input); `control` exists only while
 * the user holds the mouse and keyboard.
 *
 * The iframe stays connected for as long as the computer is running: the viewer link is minted
 * once per session (it lives longer than a session), so switching windows or opening the full
 * screen never reloads it. It is dropped only when the computer stops or the mode changes.
 *
 * noVNC's own connect/error/reconnect screens are hidden by the proxy, which instead posts its
 * connection state here; until it is connected, one calm loading state is shown over the last
 * saved screen.
 */
export function ComputerScreen({
  mode,
  enabled,
  poster,
  className,
  title = "Computer screen",
}: {
  mode: "watch" | "control";
  /** False while the computer is asleep: nothing is requested then. */
  enabled: boolean;
  /** The last saved screen, shown dimmed while connecting. */
  poster?: string | null;
  className?: string;
  title?: string;
}) {
  const { src, state, frameRef } = useVncViewer(enabled, mode);

  const live = src !== null && state === "connected";
  return (
    <>
      {src && (
        <iframe
          ref={frameRef}
          key={mode}
          title={title}
          src={src}
          className={`${className ?? ""} ${live ? "" : "invisible"}`}
          // The page is ours, but it is a remote desktop: no popups, no top navigation.
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
        />
      )}
      {!live && (
        <div className="absolute inset-0 flex items-center justify-center">
          {poster && (
            // biome-ignore lint/performance/noImgElement: a private blob: URL, not an optimisable asset
            <img
              src={poster}
              alt=""
              className="absolute inset-0 size-full object-contain opacity-30"
            />
          )}
          <span className="relative flex items-center gap-2 rounded-md bg-background/70 px-3 py-1.5 text-xs backdrop-blur-sm">
            <Loader2Icon className="size-3.5 animate-spin" />
            {state === "reconnecting"
              ? "Reconnecting to the screen…"
              : "Connecting to the screen…"}
          </span>
        </div>
      )}
    </>
  );
}
