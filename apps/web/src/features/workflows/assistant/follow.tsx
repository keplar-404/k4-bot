"use client";

import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";
import { useBuilder } from "../builder/store";

/** How long a block the assistant added stays highlighted. */
const HIGHLIGHT_MS = 1600;

/**
 * Follows the assistant on the canvas: a block it just added that lands off-screen is brought into view (blocks
 * already in view never make the canvas jump), and the highlight is cleared after a moment.
 */
export function AssistantFollow() {
  const fresh = useBuilder((s) => s.fresh);
  const { fitView, flowToScreenPosition } = useReactFlow();

  useEffect(() => {
    if (fresh.length === 0) return;
    const nodes = useBuilder
      .getState()
      .nodes.filter((n) => fresh.includes(n.id));
    const offScreen = nodes.some((n) => {
      const p = flowToScreenPosition(n.position);
      return (
        p.x < 0 ||
        p.y < 0 ||
        p.x + 240 > window.innerWidth ||
        p.y + 64 > window.innerHeight
      );
    });
    if (offScreen)
      void fitView({
        nodes: nodes.map((n) => ({ id: n.id })),
        padding: 0.8,
        maxZoom: 1,
        duration: 300,
      });
    const t = setTimeout(
      () => useBuilder.setState({ fresh: [] }),
      HIGHLIGHT_MS,
    );
    return () => clearTimeout(t);
  }, [fresh, fitView, flowToScreenPosition]);

  return null;
}
