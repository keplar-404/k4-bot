"use client";

import { PlusIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { DeleteGroupDialog } from "./delete-group-dialog";
import { GroupDialog } from "./group-dialog";
import { GroupItem } from "./group-item";
import { useGroupsStore } from "./store";
import { useGroups } from "./use-groups";

/** The sidebar's Groups: group chats of several bots, each shown with its bots' avatars. */
export function NavGroups() {
  const router = useRouter();
  const pathname = usePathname();
  const { groups } = useGroups();
  // The section's UI state lives in the groups store.
  const editing = useGroupsStore((s) => s.editing);
  const open = useGroupsStore((s) => s.dialogOpen);
  const deleting = useGroupsStore((s) => s.deleting);
  const openCreate = useGroupsStore((s) => s.openCreate);
  const openEdit = useGroupsStore((s) => s.openEdit);
  const setOpen = useGroupsStore((s) => s.setDialogOpen);
  const setDeleting = useGroupsStore((s) => s.setDeleting);
  return (
    <SidebarGroup>
      <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Groups</SidebarGroupLabel>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New group"
          onClick={openCreate}
        >
          <PlusIcon />
        </Button>
      </div>
      <SidebarMenu>
        {groups?.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Put bots together to work as a team.
          </p>
        )}
        {groups?.map((g) => (
          <GroupItem
            key={g.id}
            group={g}
            active={pathname === `/dashboard/group/${g.id}`}
            onEdit={openEdit}
            onDelete={setDeleting}
          />
        ))}
      </SidebarMenu>
      <GroupDialog
        open={open}
        onOpenChange={setOpen}
        group={editing}
        onSaved={(g) => {
          setOpen(false);
          if (!editing) router.push(`/dashboard/group/${g.id}`);
        }}
      />
      <DeleteGroupDialog
        group={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(g) => {
          if (pathname === `/dashboard/group/${g.id}`)
            router.replace("/dashboard");
        }}
      />
    </SidebarGroup>
  );
}
