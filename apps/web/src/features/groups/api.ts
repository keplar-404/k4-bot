import { request } from "@/features/chat/lib/client/http";

export type GroupMember = {
  id: string;
  name: string;
  role: string;
  shape: string;
  color: string;
  expression: string;
};
export type Group = {
  id: string;
  name: string;
  leadBotId: string | null;
  memory: string;
  members: GroupMember[];
};
export type GroupInput = { name: string; botIds: string[]; leadBotId?: string };

/** Other parts of the page (sidebar, chat header) refresh when a group changes. */
export const GROUPS_CHANGED = "k4:groups-changed";
const changed = () => window.dispatchEvent(new Event(GROUPS_CHANGED));

export const listGroups = () =>
  request<{ groups: Group[] }>("/api/v1/groups").then((r) => r.groups);

export async function createGroup(input: GroupInput) {
  const { group } = await request<{ group: Group }>("/api/v1/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
  changed();
  return group;
}

export async function updateGroup(
  id: string,
  patch: Partial<GroupInput> & { memory?: string },
) {
  const { group } = await request<{ group: Group }>(`/api/v1/groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  changed();
  return group;
}

export async function deleteGroup(id: string) {
  await request(`/api/v1/groups/${id}`, { method: "DELETE" });
  changed();
}

/** How a member is written in a message: @bot:storywriter (the server matches it the same way). */
export const mentionKey = (name: string) =>
  name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export const leadOf = (g: Group) =>
  g.members.find((m) => m.id === g.leadBotId) ?? g.members[0];
