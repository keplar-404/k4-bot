"use client";

import { useEffect, useState } from "react";

/** Seconds until `endsAt` (local clock), ticking once a second while there is one. */
export function useSecondsLeft(endsAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt === null
    ? null
    : Math.max(0, Math.round((endsAt - now) / 1000));
}

export const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
