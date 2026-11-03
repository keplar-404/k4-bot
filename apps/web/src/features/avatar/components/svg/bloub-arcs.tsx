import type { BotFrame } from "@/features/avatar/bloub/bot/engine";

/** The arcs around the body: the back halves are drawn before it, the front halves after. */
export function BloubArcs({
  frame,
  uid,
  side,
}: {
  frame: BotFrame;
  uid: string;
  side: "back" | "front";
}) {
  return (
    <g fill="none" strokeLinecap="round">
      {frame.arcs.map((arc) => (
        <path
          key={`${side === "back" ? "b" : "f"}${arc.id}`}
          d={side === "back" ? arc.back : arc.front}
          stroke={`url(#${uid}-${arc.id})`}
          strokeWidth={arc.width}
          opacity={arc.opacity}
        />
      ))}
    </g>
  );
}
