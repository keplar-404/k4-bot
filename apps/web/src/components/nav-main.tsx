"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * The app's main pages. `<Link>` keeps navigation client-side (and prefetched) instead of reloading the app.
 * An item with `onSelect` opens something in place (a dialog) instead of navigating.
 */
export function NavMain({
  items,
}: {
  items: {
    title: string;
    url?: string;
    icon?: React.ReactNode;
    onSelect?: () => void;
  }[];
}) {
  const pathname = usePathname();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            {item.onSelect || !item.url ? (
              <SidebarMenuButton
                tooltip={item.title}
                onClick={item.onSelect}
                className="cursor-pointer"
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                render={<Link href={item.url} />}
                tooltip={item.title}
                isActive={
                  pathname === item.url ||
                  // A section stays highlighted on its sub-pages; Dashboard is the parent of everything, so exact only.
                  (item.url !== "/dashboard" &&
                    pathname.startsWith(`${item.url}/`))
                }
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
