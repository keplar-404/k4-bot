"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePanelRef } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./use-workspace";
import { WorkspacePanels } from "./workspace-panels";
import { readSidebarOpen } from "./workspace-state";

const WIDE = "(min-width: 1024px)";

function useWide() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

/**
 * The chat and its right side bar. On wide screens the side bar is a resizable panel (drag the divider; it keeps
 * between 320px and 60% of the width, and the chat keeps at least 360px) that the header button hides and shows;
 * its open/closed choice is kept in this browser, so a reload starts it the same way. On narrow ones the same
 * tabs open in a sheet from a button.
 */
export function WorkspaceSidebar({
  botId,
  children,
}: {
  botId: string;
  children: ReactNode;
}) {
  const wide = useWide();
  const panel = usePanelRef();
  const { sidebarOpen, setSidebarOpen, setSidebarOpenState } = useWorkspace();

  // Ignore resizes that happen during the initial mount/layout, so a reload does not overwrite the saved choice.
  const mountTime = useRef(Date.now());

  // Wide screens start from the side bar's saved choice; narrow ones (where it is a sheet) keep it hidden until the
  // header button asks for it, and resizing across the breakpoint shows or hides it as before. The query is read
  // directly rather than through `wide`, because the hydrated first render always reports the server's `false`.
  const prevWide = useRef<boolean | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: wide only re-fires the effect; the value comes from the query
  useEffect(() => {
    const realWide = window.matchMedia(WIDE).matches;
    if (prevWide.current === undefined) {
      prevWide.current = realWide;
      if (realWide) setSidebarOpen(readSidebarOpen());
      else setSidebarOpenState(false); // narrow: closed on load, without clobbering the saved choice
      return;
    }
    if (prevWide.current !== realWide) {
      prevWide.current = realWide;
      if (realWide) setSidebarOpen(readSidebarOpen());
      else setSidebarOpenState(false);
    }
  }, [wide, setSidebarOpen]);

  // The header button drives the panel. The slide class goes on first and the resize happens two frames later, so the
  // browser sees a change to animate (the same 200ms linear slide as the app side bar). A drag never slides: a
  // transition then would make the divider lag behind the pointer.
  const [sliding, setSliding] = useState(false);
  useEffect(() => {
    const p = panel.current;
    if (!p || sidebarOpen !== p.isCollapsed()) return;
    setSliding(true);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const live = panel.current;
        if (sidebarOpen) live?.expand();
        else live?.collapse();
      });
    });
    const done = setTimeout(() => setSliding(false), 300);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      clearTimeout(done);
    };
  }, [sidebarOpen, panel]);
  const slide = sliding && "transition-[flex-grow] duration-200 ease-linear";

  if (wide) {
    return (
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel id="chat" minSize={360} className={cn(slide)}>
          {children}
        </ResizablePanel>
        <ResizableHandle
          withHandle
          disabled={!sidebarOpen}
          className={cn(!sidebarOpen && "pointer-events-none opacity-0")}
        />
        <ResizablePanel
          id="workspace"
          aria-label="Workspace"
          panelRef={panel}
          // A panel is born collapsed when the saved choice was closed, so a reload shows it that way at once
          // (opening it later expands to minSize; every open after that returns to the last dragged size).
          defaultSize={sidebarOpen ? 480 : 0}
          minSize={320}
          maxSize="60%"
          collapsible
          collapsedSize={0}
          onResize={() => {
            if (Date.now() - mountTime.current < 200) return;
            const collapsed = panel.current?.isCollapsed();
            if (collapsed === undefined) return;
            setSidebarOpen(!collapsed);
          }}
          className={cn("flex flex-col overflow-hidden", slide)}
        >
          <div className="flex h-full min-w-80 flex-1 flex-col">
            <WorkspacePanels botId={botId} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-lg"
        >
          <SheetTitle className="sr-only">Workspace</SheetTitle>
          <SheetDescription className="sr-only">
            Your computer, a browser and this bot&apos;s files.
          </SheetDescription>
          {sidebarOpen && <WorkspacePanels botId={botId} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
