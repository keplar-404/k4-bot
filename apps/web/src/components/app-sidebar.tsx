"use client";

import {
  BotIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  PuzzleIcon,
  ServerIcon,
  UserIcon,
} from "lucide-react";
import type * as React from "react";
import { IntegrationsDialog } from "@/components/integrations/integrations-dialog";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
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
import { openIntegrations } from "@/lib/integrations";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  // Skills and MCP open one dialog (tabs), on the tab that was clicked.
  {
    title: "Skills",
    icon: <PuzzleIcon />,
    onSelect: () => openIntegrations("skills"),
  },
  {
    title: "MCP",
    icon: <ServerIcon />,
    onSelect: () => openIntegrations("mcp"),
  },
  { title: "VM machine", url: "/dashboard/vm", icon: <MonitorIcon /> },
  { title: "Files", url: "/dashboard/files", icon: <FolderOpenIcon /> },
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
