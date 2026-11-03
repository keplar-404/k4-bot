"use client";

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/features/auth/auth-client";
import { UserIdentity } from "./user-identity";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const name = user?.name ?? "";
  const email = user?.email ?? "";
  const avatar = (user as { image?: string | null } | undefined)?.image ?? "";

  async function handleSignOut() {
    await signOut();
    // A full navigation: nothing of this session (cached bots, open sockets) carries over.
    window.location.replace("/sign-in");
  }

  // No "Guest" placeholder: while the session loads there is no one to show yet, and without one the
  // dashboard's AuthGuard is already on its way to the sign-in page.
  if (isPending || !user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center gap-2 p-2">
          <Skeleton className="size-8 rounded-full" />
          <div className="grid flex-1 gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <UserIdentity name={name} email={email} avatar={avatar} />
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <UserIdentity name={name} email={email} avatar={avatar} />
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
