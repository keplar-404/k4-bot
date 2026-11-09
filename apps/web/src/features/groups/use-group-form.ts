"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createGroup, type Group, updateGroup } from "./api";

/** The group dialog's fields; reset whenever it opens. Saving creates or updates the group. */
export function useGroupForm(
  open: boolean,
  group: Group | null,
  onSaved: (g: Group) => void,
) {
  const [name, setName] = useState("");
  const [botIds, setBotIds] = useState<string[]>([]);
  const [leadBotId, setLeadBotId] = useState("");
  const [memory, setMemory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setBotIds(group?.members.map((m) => m.id) ?? []);
    setLeadBotId(group?.leadBotId ?? "");
    setMemory(group?.memory ?? "");
  }, [open, group]);

  const toggle = (id: string) =>
    setBotIds((ids) =>
      ids.includes(id) ? ids.filter((b) => b !== id) : [...ids, id],
    );
  const lead = botIds.includes(leadBotId) ? leadBotId : (botIds[0] ?? "");
  const problem = !name.trim()
    ? "Name the group."
    : botIds.length < 2
      ? "Pick at least two bots."
      : null;

  async function save() {
    if (problem) return;
    setSaving(true);
    try {
      const input = { name: name.trim(), botIds, leadBotId: lead };
      onSaved(
        group
          ? await updateGroup(group.id, { ...input, memory })
          : await createGroup(input),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the group.");
    } finally {
      setSaving(false);
    }
  }
  return {
    name,
    setName,
    botIds,
    toggle,
    lead,
    setLeadBotId,
    memory,
    setMemory,
    saving,
    problem,
    save,
  };
}
