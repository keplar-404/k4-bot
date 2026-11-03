import {
  HandIcon,
  Loader2Icon,
  MonitorIcon,
  PauseIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { Button } from "@/components/ui/button";
import type {
  Computer,
  ComputerAction,
} from "@/features/computer/hooks/use-computer";
import { StateBadge } from "./state-badge";

/** The full-screen bar: who is in control, Take control / Give back, Sleep, and Close. */
export function FullscreenHeader({
  computer,
  doing,
  closeRef,
  onClose,
}: {
  computer: Computer;
  doing: string | null;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { status, inControl, busy, pending } = computer;
  const live = status?.state === "running";
  /** The button's own icon, or a spinner while its action runs. */
  const icon = (action: ComputerAction, idle: ReactNode) =>
    pending === action ? <Loader2Icon className="animate-spin" /> : idle;
  if (!status) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MonitorIcon className="size-4" />
      <span className="text-sm font-medium">Computer</span>
      <StateBadge status={status} />
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {doing ?? (live ? "Idle. Nobody is using the mouse." : "Asleep")}
      </span>
      {live &&
        (inControl ? (
          <Button
            size="sm"
            onClick={() => void computer.releaseControl()}
            disabled={busy}
            aria-busy={pending === "release"}
          >
            {icon("release", <HandIcon />)}
            Give control back
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void computer.takeControl()}
            disabled={busy}
            aria-busy={pending === "take"}
          >
            {icon("take", <HandIcon />)}
            Take control
          </Button>
        ))}
      {live && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void computer.pause()}
          disabled={busy}
          aria-busy={pending === "pause"}
        >
          {icon("pause", <PauseIcon />)}
          Sleep
        </Button>
      )}
      <Button
        ref={closeRef}
        size="icon-sm"
        variant="ghost"
        aria-label="Close full screen"
        onClick={() => onClose()}
      >
        <XIcon />
      </Button>
    </div>
  );
}
