"use client";

import { SettingsIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatView } from "@/features/chat/components/chat-view";
import { ComputerProvider } from "@/features/computer/components/computer-provider";
import { SessionWrapUp } from "@/features/computer/components/session-wrap-up";
import { leadOf } from "./api";
import { AvatarStack } from "./avatar-stack";
import { GroupDialog } from "./group-dialog";
import { useGroups } from "./use-groups";

/** A group's chat: its bots answer in one conversation (the lead, or whoever a message names with @bot:name). */
export function GroupChatPage() {
  const params = useParams<{ id: string }>();
  const { groups } = useGroups();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const group = groups?.find((g) => g.id === params.id);
  const lead = group ? leadOf(group) : undefined;
  return (
    <div className="flex h-svh min-h-0 min-w-0 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        {group && <AvatarStack members={group.members} size={24} max={4} />}
        <span className="truncate text-sm font-medium">
          {group?.name ?? "Group"}
        </span>
        {group && (
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            {group.members.length} bots · {lead?.name} leads
          </span>
        )}
        {group && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label="Group settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
          </Button>
        )}
      </header>
      {!groups ? (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      ) : !group || !lead ? (
        <p className="p-6 text-sm text-muted-foreground">
          This group no longer exists.
        </p>
      ) : (
        <ComputerProvider>
          {/* Keyed by group: switching groups starts a fresh chat state and socket. */}
          <ChatView
            key={group.id}
            botId={lead.id}
            group={group}
            beforeComposer={<SessionWrapUp />}
          />
        </ComputerProvider>
      )}
      {group && (
        <GroupDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          group={group}
          onSaved={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
