"use client";

import { PanelRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { RightPanel } from "@/components/right-panel";
import { Button } from "@/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { openPanelTab, useComputerBusy, useViewFile } from "@/lib/chat-ui";

// Header + [page | right panel]. The right panel is always rendered and only
// collapsed, so the page (the chat and its eve stream) never remounts. It shows the
// user's computer, mounted only while open; it opens when the agent starts using it.
export function DashboardShell({ children }: { children: React.ReactNode }) {
	const panel = usePanelRef();
	const [open, setOpen] = useState(false);
	const isMobile = useIsMobile();
	// Phones get the panel as a full-width sheet, like the left sidebar.
	const [mobileOpen, setMobileOpen] = useState(false);
	// No drag handle on phones: close it when the window gets narrow.
	useEffect(() => {
		if (isMobile) panel.current?.collapse();
	}, [isMobile, panel]);
	const computerBusy = useComputerBusy();
	useEffect(() => {
		if (computerBusy) openPanelTab("computer");
		if (computerBusy && !isMobile && panel.current?.isCollapsed())
			panel.current.resize("40%");
	}, [computerBusy, isMobile, panel]);
	// A file was opened (a card's Open, the Files tab's eye): show the panel.
	const viewFile = useViewFile();
	useEffect(() => {
		if (!viewFile) return;
		if (isMobile) return setMobileOpen(true);
		if (panel.current?.isCollapsed()) panel.current.resize("40%");
		// onResize can miss a resize made right after load, leaving the panel empty.
		setOpen(true);
	}, [viewFile, isMobile, panel]);
	const shown = isMobile ? mobileOpen : open;
	const toggle = () =>
		isMobile
			? setMobileOpen((o) => !o)
			: panel.current?.isCollapsed()
				? panel.current.expand()
				: panel.current?.collapse();

	return (
		<>
			<ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
				<ResizablePanel id="main" minSize="40%" className="min-w-0">
					{/* The header lives in the chat column, so the panel's tabs take the top row. */}
					<div className="flex h-full flex-col">
						<header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
							<SidebarTrigger className="-ml-1" />
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											variant="ghost"
											size="icon-sm"
											className="ml-auto -mr-1"
											aria-label={shown ? "Close panel" : "Open panel"}
											aria-pressed={shown}
											onClick={toggle}
										/>
									}
								>
									<PanelRightIcon />
								</TooltipTrigger>
								<TooltipContent>
									{shown ? "Close panel" : "Open panel"}
								</TooltipContent>
							</Tooltip>
						</header>
						<div className="min-h-0 flex-1">{children}</div>
					</div>
				</ResizablePanel>
				<ResizableHandle className={open && !isMobile ? undefined : "hidden"} />
				<ResizablePanel
					id="right"
					panelRef={panel}
					collapsible
					collapsedSize="0%"
					defaultSize="0%"
					minSize="20%"
					maxSize="50%"
					onResize={(size) => setOpen(size.asPercentage > 0)}
				>
					<aside aria-label="Side panel" className="h-full">
						{open && <RightPanel />}
					</aside>
				</ResizablePanel>
			</ResizablePanelGroup>
			{isMobile && (
				<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
					<SheetContent
						side="right"
						className="gap-0 p-0 pt-12 data-[side=right]:w-full data-[side=right]:sm:max-w-none"
					>
						<SheetTitle className="sr-only">Side panel</SheetTitle>
						{mobileOpen && <RightPanel />}
					</SheetContent>
				</Sheet>
			)}
		</>
	);
}
