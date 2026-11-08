"use client";

import { cn } from "cn";
import { useState } from "react";

/**
 * An app's real logo (logos.composio.dev) on a white tile: brand marks are drawn for light backgrounds, so they
 * stay legible in dark mode too. A logo that fails to load becomes the app's initial.
 */
export function AppLogo({
  src,
  name,
  size = "md",
  className,
}: {
  src: string | null;
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white",
        size === "md" ? "size-10 p-1.5" : "size-7 p-1",
        className,
      )}
    >
      {src && !failed ? (
        // biome-ignore lint/performance/noImgElement: external SVG/PNG logos of any size; next/image would need every host allow-listed
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-semibold text-neutral-700 text-sm" aria-hidden>
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
