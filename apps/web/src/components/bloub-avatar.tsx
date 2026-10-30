"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { BotEngine, type BotFrame } from "@/lib/bloub/bot/engine";
import {
  DEFAULT_EXPRESSION,
  EXPRESSION_BY_ID,
} from "@/lib/bloub/bot/expressions";
import { RAYON as R, DEMI_VIEWBOX as VB } from "@/lib/bloub/bot/repere";
import {
  COLOR_BY_ID,
  DEFAULT_COLOR,
  DEFAULT_SHAPE,
  mixHex,
  SHAPE_BY_ID,
} from "@/lib/bloub/bot/skins";

export type BloubAvatarProps = {
  size?: number;
  shape?: string;
  color?: string;
  expression?: string;
  paper?: string;
  frozenAt?: number;
  animated?: boolean;
  lookAt?: { nx: number; ny: number } | null;
};

export function BloubAvatar({
  size = 200,
  shape = DEFAULT_SHAPE,
  color = DEFAULT_COLOR,
  expression = DEFAULT_EXPRESSION,
  paper = "#f9f9f9",
  frozenAt = 1,
  animated = false,
  lookAt = null,
}: BloubAvatarProps) {
  const uid = useId().replace(/:/g, "");
  const maskId = `bloub-mask-${uid}`;

  const ink = COLOR_BY_ID.get(color)?.hex ?? "#0a0a0c";
  const shapeRadii = SHAPE_BY_ID.get(shape)?.radii ?? null;
  const expr = EXPRESSION_BY_ID.get(expression) ?? null;

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

  // Morph shape smoothly.
  useEffect(() => {
    if (!animated) return;
    const engine = engineRef.current;
    if (!engine || !shapeRadii) return;
    engine.setShape(shapeRadii, clockRef.current);
  }, [animated, shapeRadii]);

  // Morph expression smoothly.
  useEffect(() => {
    if (!animated) return;
    const engine = engineRef.current;
    if (!engine || !expr) return;
    engine.setExpression(expr, clockRef.current);
  }, [animated, expr]);

  // Gaze: look at a normalized point when provided.
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

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}
      role="img"
      aria-label="Bloub avatar"
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={-VB}
          y={-VB}
          width={VB * 2}
          height={VB * 2}
        >
          <path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye) => (
            <path
              key={eye.matrix}
              d={eye.d}
              transform={eye.matrix}
              opacity={eye.alpha}
              fill="#000"
            />
          ))}
          {frame.notch && (
            <circle
              cx={frame.notch.x}
              cy={frame.notch.y}
              r={frame.notch.r}
              fill="#000"
            />
          )}
        </mask>
        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${uid}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((c, i) => (
              <stop
                key={`${i}-${c}`}
                offset={i / (arc.grad.stops.length - 1)}
                stopColor={c}
              />
            ))}
          </linearGradient>
        ))}
      </defs>

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`b${arc.id}`}
            d={arc.back}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>

      {frame.dotsBehind && (
        <g>
          {frame.dots.map((dot) => {
            const fill =
              dot.color ??
              (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth));
            if (dot.d) {
              return (
                <path
                  key={`pb-${dot.x}-${dot.y}`}
                  d={dot.d}
                  transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`}
                  fill={fill}
                  opacity={dot.opacity}
                />
              );
            }
            return (
              <circle
                key={`pb-${dot.x}-${dot.y}`}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={fill}
                opacity={dot.opacity}
              />
            );
          })}
        </g>
      )}

      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill={paper} />
        <g mask={`url(#${maskId})`}>
          <rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} fill={ink} />
        </g>
      </g>

      {!frame.dotsBehind && (
        <g>
          {frame.dots.map((dot) => {
            const fill =
              dot.color ??
              (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth));
            if (dot.d) {
              return (
                <path
                  key={`pf-${dot.x}-${dot.y}`}
                  d={dot.d}
                  transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`}
                  fill={fill}
                  opacity={dot.opacity}
                />
              );
            }
            return (
              <circle
                key={`pf-${dot.x}-${dot.y}`}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={fill}
                opacity={dot.opacity}
              />
            );
          })}
        </g>
      )}

      {frame.notif && (
        <circle
          cx={frame.notif.x}
          cy={frame.notif.y}
          r={frame.notif.r}
          fill="#3b93f0"
        />
      )}

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`f${arc.id}`}
            d={arc.front}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>
    </svg>
  );
}
