"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BotEngine, type BotFrame } from "@/features/avatar/bloub/bot/engine";
import type { EXPRESSION_BY_ID } from "@/features/avatar/bloub/bot/expressions";
import { RAYON as R } from "@/features/avatar/bloub/bot/repere";
import { useBloubMorph } from "./use-bloub-morph";

export type Expression = NonNullable<
  ReturnType<(typeof EXPRESSION_BY_ID)["get"]>
>;
export type Radii = ConstructorParameters<typeof BotEngine>[2];

/**
 * The avatar's current frame from the bloub engine: one sample when frozen; when animated, a persistent engine
 * driven by requestAnimationFrame that morphs shape, expression and gaze smoothly.
 */
export function useBloubFrame(o: {
  shapeRadii: Radii;
  expr: Expression | null;
  frozenAt: number;
  animated: boolean;
  lookAt: { nx: number; ny: number } | null;
}): BotFrame {
  const { shapeRadii, expr, frozenAt, animated, lookAt } = o;
  const [frame, setFrame] = useState<BotFrame>(() => {
    const engine = new BotEngine(R, "idle", shapeRadii, expr);
    return engine.sample(frozenAt);
  });

  const engineRef = useRef<BotEngine | null>(null);
  const clockRef = useRef(0);
  const [, startTransition] = useTransition();

  // Frozen mode: single sample.
  useEffect(() => {
    if (animated) return;
    const engine = new BotEngine(R, "idle", shapeRadii, expr);
    setFrame(engine.sample(frozenAt));
  }, [animated, frozenAt, shapeRadii, expr]);

  // Animated mode: persistent engine + rAF loop.
  // biome-ignore lint/correctness/useExhaustiveDependencies: engine created once per session
  useEffect(() => {
    if (!animated) return;
    const engine = new BotEngine(R, "idle", shapeRadii, expr);
    engineRef.current = engine;
    clockRef.current = 0;
    engine.setState("idle", 0);
    let raf = 0;
    let last = 0;
    const tick = (ms: number) => {
      const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0;
      last = ms;
      clockRef.current += dt;
      const next = engine.sample(clockRef.current);
      startTransition(() => setFrame(next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated]);

  useBloubMorph(engineRef, clockRef, { animated, shapeRadii, expr, lookAt });

  return frame;
}
