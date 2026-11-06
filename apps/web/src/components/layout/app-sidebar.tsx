"use client";

import {
  BotIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  PlugIcon,
  PuzzleIcon,
  UserIcon,
  WorkflowIcon,
} from "lucide-react";
import type * as React from "react";
import { NavMain } from "@/components/layout/nav-main";
import { NavProjects } from "@/components/layout/nav-projects";
import { NavUser } from "@/components/layout/nav-user";
import { ThemeToggleButton } from "@/components/layout/theme-toggle-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { openIntegrations } from "@/features/integrations/api";
import { IntegrationsDialog } from "@/features/integrations/components/integrations-dialog";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  // Plugins: skills and MCP servers, one dialog with a tab for each.
  {
    title: "Plugins",
    icon: <PuzzleIcon />,
    onSelect: () => openIntegrations("skills"),
  },
  { title: "VM machine", url: "/dashboard/vm", icon: <MonitorIcon /> },
  { title: "Files", url: "/dashboard/files", icon: <FolderOpenIcon /> },
  { title: "Connect", url: "/dashboard/connect", icon: <PlugIcon /> },
  { title: "Workflow", url: "/dashboard/workflow", icon: <WorkflowIcon /> },
  { title: "Sandboxes", url: "/dashboard/sandboxes", icon: <MonitorIcon /> },
  { title: "Avatar", url: "/dashboard/avatar", icon: <UserIcon /> },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <BotIcon className="size-4" />
              </div>
              <span className="truncate font-medium">K4 Bot</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggleButton />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
      <IntegrationsDialog />
    </Sidebar>
  );
}
