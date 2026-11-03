import { MaximizeIcon } from "lucide-react";
import type { Computer } from "@/features/computer/hooks/use-computer";
import { cn } from "@/lib/utils";
import { ComputerScreen } from "../computer-screen";
import { Asleep } from "./asleep";

/** The live screen (or the asleep card). In the preview it is a button that opens the full screen. */
export function ScreenArea({
  computer,
  open,
  doing,
  onOpen,
}: {
  computer: Computer;
  open: boolean;
  doing: string | null;
  onOpen: () => void;
}) {
  const { status, inControl } = computer;
  const live = status?.state === "running";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-black",
        open ? "min-h-0" : "aspect-[16/10]",
      )}
    >
      {live ? (
        <>
          <ComputerScreen
            mode={inControl ? "control" : "watch"}
            enabled={live}
            poster={computer.snapshot}
            title="Computer"
            className={cn(
              "size-full border-0",
              !(open && inControl) && "pointer-events-none",
            )}
          />
          {!open && (
            <button
              type="button"
              onClick={() => onOpen()}
              aria-label="Open the computer full screen"
              className="absolute inset-0 flex items-end justify-end bg-transparent p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="rounded-md bg-background/80 p-1.5 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <MaximizeIcon className="size-4" />
              </span>
            </button>
          )}
          {doing && !open && (
            <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-1 text-[11px] backdrop-blur">
              {doing}
            </span>
          )}
        </>
      ) : (
        <Asleep computer={computer} />
      )}
    </div>
  );
}
