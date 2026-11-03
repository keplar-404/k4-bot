import { Loader2Icon, MaximizeIcon, PauseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Computer } from "@/features/computer/hooks/use-computer";

/** Under the preview: Open (full screen) and Sleep. */
export function PreviewActions({
  computer,
  onOpen,
}: {
  computer: Computer;
  onOpen: () => void;
}) {
  const { busy, pending } = computer;
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="flex-1"
        onClick={() => onOpen()}
      >
        <MaximizeIcon />
        Open
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void computer.pause()}
        disabled={busy}
        aria-busy={pending === "pause"}
      >
        {pending === "pause" ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <PauseIcon />
        )}
        Sleep
      </Button>
    </div>
  );
}
