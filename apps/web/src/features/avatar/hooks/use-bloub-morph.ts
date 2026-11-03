"use client";

import { type RefObject, useEffect } from "react";
import type { BotEngine } from "@/features/avatar/bloub/bot/engine";
import type { Expression, Radii } from "./use-bloub-frame";

/** While animated: morph the running engine to a new shape or expression, and point its gaze. */
export function useBloubMorph(
  engineRef: RefObject<BotEngine | null>,
  clockRef: RefObject<number>,
  o: {
    animated: boolean;
    shapeRadii: Radii;
    expr: Expression | null;
    lookAt: { nx: number; ny: number } | null;
  },
) {
  const { animated, shapeRadii, expr, lookAt } = o;
  // Morph shape smoothly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are stable; their current values are read when it runs
  useEffect(() => {
    if (!animated) return;
    const engine = engineRef.current;
    if (!engine || !shapeRadii) return;
    engine.setShape(shapeRadii, clockRef.current);
  }, [animated, shapeRadii]);

  // Morph expression smoothly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are stable; their current values are read when it runs
  useEffect(() => {
    if (!animated) return;
    const engine = engineRef.current;
    if (!engine || !expr) return;
    engine.setExpression(expr, clockRef.current);
  }, [animated, expr]);

  // Gaze: look at a normalized point when provided.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are stable; their current values are read when it runs
  useEffect(() => {
    if (!animated) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (lookAt) {
      engine.setLook(
        {
          yaw: lookAt.nx * 16,
          pitch: 10 - lookAt.ny * 13,
          mix: 1,
          spin: 0,
          wander: 0,
        },
        clockRef.current,
        0.3,
      );
    } else {
      engine.setLook(null, clockRef.current, 0.3);
    }
  }, [animated, lookAt]);
}
