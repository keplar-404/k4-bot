"use client";

import {
  BotIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  PuzzleIcon,
  ServerIcon,
  UserIcon,
} from "lucide-react";
import type * as React from "react";
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

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  { title: "MCP", url: "/dashboard/mcp", icon: <ServerIcon /> },
  { title: "Skills", url: "/dashboard/skills", icon: <PuzzleIcon /> },
  { title: "VM machine", url: "/dashboard/vm", icon: <MonitorIcon /> },
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
        <NavMain items={[]} extraItems={navItems} />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggleButton />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
