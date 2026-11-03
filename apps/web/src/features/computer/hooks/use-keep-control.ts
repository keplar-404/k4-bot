"use client";

import { useEffect } from "react";
import { keepControl } from "@/features/computer/api";

/** How often the page tells the server the user still holds the mouse (the server lets go after 5 min of silence). */
const KEEP_CONTROL_MS = 15_000;

/** While the user holds the mouse, say so regularly; a closed tab then hands control back by itself. */
export function useKeepControl(inControl: boolean) {
  useEffect(() => {
    if (!inControl) return;
    const id = setInterval(
      () => void keepControl().catch(() => undefined),
      KEEP_CONTROL_MS,
    );
    return () => clearInterval(id);
  }, [inControl]);
}
