"use client";

import { useId } from "react";
import {
  DEFAULT_EXPRESSION,
  EXPRESSION_BY_ID,
} from "@/features/avatar/bloub/bot/expressions";
import { DEMI_VIEWBOX as VB } from "@/features/avatar/bloub/bot/repere";
import {
  COLOR_BY_ID,
  DEFAULT_COLOR,
  DEFAULT_SHAPE,
  SHAPE_BY_ID,
} from "@/features/avatar/bloub/bot/skins";
import { useBloubFrame } from "@/features/avatar/hooks/use-bloub-frame";
import { BloubArcs } from "./svg/bloub-arcs";
import { BloubDefs } from "./svg/bloub-defs";
import { BloubDots } from "./svg/bloub-dots";

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

  const frame = useBloubFrame({ shapeRadii, expr, frozenAt, animated, lookAt });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}
      role="img"
      aria-label="Bloub avatar"
    >
      <BloubDefs frame={frame} uid={uid} maskId={maskId} />
      <BloubArcs frame={frame} uid={uid} side="back" />
      {frame.dotsBehind && (
        <BloubDots frame={frame} ink={ink} paper={paper} prefix="pb" />
      )}
      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill={paper} />
        <g mask={`url(#${maskId})`}>
          <rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} fill={ink} />
        </g>
      </g>
      {!frame.dotsBehind && (
        <BloubDots frame={frame} ink={ink} paper={paper} prefix="pf" />
      )}
      {frame.notif && (
        <circle
          cx={frame.notif.x}
          cy={frame.notif.y}
          r={frame.notif.r}
          fill="#3b93f0"
        />
      )}
      <BloubArcs frame={frame} uid={uid} side="front" />
    </svg>
  );
}
