"use client";

import { useState } from "react";

/**
 * The tab's own history (an iframe's real history cannot be read across origins, as in DeepSeek's web build).
 * `loadId` changes on every navigation and on Reload, so the iframe is re-created even for the same URL.
 */
export function useBrowserHistory(initial = "") {
  const [h, setH] = useState({
    stack: initial ? [initial] : [],
    index: initial ? 0 : -1,
    loadId: 0,
  });
  const go = (index: number) =>
    setH((s) => ({ ...s, index, loadId: s.loadId + 1 }));
  return {
    url: h.stack[h.index] ?? "",
    loadId: h.loadId,
    canBack: h.index > 0,
    canForward: h.index < h.stack.length - 1,
    push: (url: string) =>
      setH((s) => ({
        stack: [...s.stack.slice(0, s.index + 1), url],
        index: s.index + 1,
        loadId: s.loadId + 1,
      })),
    back: () => go(Math.max(0, h.index - 1)),
    forward: () => go(Math.min(h.stack.length - 1, h.index + 1)),
    reload: () => go(h.index),
  };
}
