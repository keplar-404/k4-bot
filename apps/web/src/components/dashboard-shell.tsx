"use client";

import { PanelRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { ComputerPanel } from "@/components/computer-panel";
import { Button } from "@/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useComputerBusy } from "@/lib/chat-ui";

// Header + [page | right panel]. The right panel is always rendered and only
// collapsed, so the page (the chat and its eve stream) never remounts. It shows the
// user's computer, mounted only while open; it opens when the agent starts using it.
export function DashboardShell({ children }: { children: React.ReactNode }) {
	const panel = usePanelRef();
	const [open, setOpen] = useState(false);
	const isMobile = useIsMobile();
	// No drag handle on phones: close it when the window gets narrow.
	useEffect(() => {
		if (isMobile) panel.current?.collapse();
	}, [isMobile, panel]);
	const computerBusy = useComputerBusy();
	useEffect(() => {
		if (computerBusy && !isMobile && panel.current?.isCollapsed())
			panel.current.resize("40%");
	}, [computerBusy, isMobile, panel]);
	const toggle = () =>
		panel.current?.isCollapsed()
			? panel.current.expand()
			: panel.current?.collapse();

	return (
		<>
			<header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
				<SidebarTrigger className="-ml-1" />
				{!isMobile && (
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant="ghost"
									size="icon-sm"
									className="ml-auto -mr-1"
									aria-label={open ? "Close computer" : "Open computer"}
									aria-pressed={open}
									onClick={toggle}
								/>
							}
						>
							<PanelRightIcon />
						</TooltipTrigger>
						<TooltipContent>
							{open ? "Close computer" : "Open computer"}
						</TooltipContent>
					</Tooltip>
				)}
			</header>
			<ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
				<ResizablePanel id="main" minSize="40%" className="min-w-0">
					{children}
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
					<aside aria-label="Your computer" className="h-full">
						{open && <ComputerPanel />}
					</aside>
				</ResizablePanel>
			</ResizablePanelGroup>
		</>
	);
}
