"use client";

import { Button } from "@/components/ui/button";

/** In-chat card asking the user to switch permission mode so the plan can be carried out. */
export function ModeSwitchItem({
  to,
  reason,
  plan,
  onSwitch,
  onStay,
}: {
  to?: string;
  reason?: string;
  plan?: string;
  onSwitch: (mode: "ask" | "allow_all") => void;
  onStay: () => void;
}) {
  const target = to === "allow_all" ? "allow_all" : "ask";
  const label = target === "allow_all" ? "Allow all" : "Ask";
  return (
    <div className="rounded-lg border bg-card p-4 text-sm">
      <p className="font-medium">The bot wants to switch to {label} mode.</p>
      {reason && <p className="mt-1 text-muted-foreground">{reason}</p>}
      {plan && (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
          {plan}
        </pre>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onSwitch(target)}>
          Switch to {label} &amp; continue
        </Button>
        <Button size="sm" variant="outline" onClick={onStay}>
          Stay in Plan
        </Button>
      </div>
    </div>
  );
}
