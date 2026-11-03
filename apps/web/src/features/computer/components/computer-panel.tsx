"use client";

import { useComputerContext } from "@/features/computer/components/computer-provider";
import { useFullscreen } from "@/features/computer/hooks/use-fullscreen";
import { cn } from "@/lib/utils";
import { Activity } from "./panel/activity";
import { FullscreenHeader } from "./panel/fullscreen-header";
import { PanelLoadingSkeleton as LoadingSkeleton } from "./panel/loading-skeleton";
import { PanelHeader } from "./panel/panel-header";
import { PreviewActions } from "./panel/preview-actions";
import { ScreenArea } from "./panel/screen-area";
import { SideColumn } from "./panel/side-column";
import { who } from "./panel/state-badge";
import { Usage } from "./panel/usage";

/**
 * Computer in the bot page's right sidebar: live preview (click for full screen), what
 * the bots are doing, today's usage. One computer per user, shared by all their bots.
 * Full screen is the same element growing to cover the window, not a second viewer in
 * a dialog — moving an iframe reloads it (that's what made the preview go black). */
export function ComputerPanel({
  botId,
  className,
}: {
  botId: string;
  className?: string;
}) {
  const computer = useComputerContext();
  const { status, inControl } = computer;
  const live = status?.state === "running";
  const { open, setOpen, closeRef } = useFullscreen(live || inControl);

  if (!status) {
    return <LoadingSkeleton className={className} />;
  }

  const doing = who(status, botId);

  return (
    <div className={cn("flex min-h-0 flex-col gap-4 p-4", className)}>
      <PanelHeader computer={computer} status={status} />

      {/* The same element is the preview and the full screen; only its classes change. */}
      <div
        {...(open
          ? {
              role: "dialog",
              "aria-modal": true,
              "aria-label": "Computer, full screen",
            }
          : {})}
        className={cn(
          open
            ? "fixed inset-0 z-50 flex flex-col gap-3 bg-background/95 p-3 backdrop-blur-sm"
            : "flex flex-col gap-2",
        )}
      >
        {open && (
          <FullscreenHeader
            computer={computer}
            doing={doing}
            closeRef={closeRef}
            onClose={() => setOpen(false)}
          />
        )}
        <div
          className={cn(
            open
              ? "grid min-h-0 flex-1 gap-3 md:grid-cols-[1fr_16rem]"
              : "contents",
          )}
        >
          <ScreenArea
            computer={computer}
            open={open}
            doing={doing}
            onOpen={() => setOpen(true)}
          />
          {open && <SideColumn computer={computer} botId={botId} />}
        </div>
        {live && !open && (
          <PreviewActions computer={computer} onOpen={() => setOpen(true)} />
        )}
        {computer.error && (
          <p className="text-xs text-destructive">{computer.error}</p>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Activity</h3>
        <Activity
          events={computer.activity}
          botId={botId}
          className="min-h-0 flex-1"
        />
      </div>
      <Usage status={status} />
    </div>
  );
}
