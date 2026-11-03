"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type InstalledSkill,
  uninstallSkill,
} from "@/features/integrations/api";
import { RoleBadge } from "./role-badge";

/** The user's installed skills, each with Remove (which also takes it off their bots). */
export function InstalledSkills({
  installed,
}: {
  installed: InstalledSkill[];
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const remove = async (id: string, name: string) => {
    setRemoving(id);
    try {
      await uninstallSkill(id);
      toast.success(`Removed ${name}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Installed</h3>
      {installed.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No skills yet. Install one below, then add it to a bot from the
          bot&apos;s settings.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {installed.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.description}
                </p>
              </div>
              <RoleBadge role={s.role} />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${s.title}`}
                title="Remove (also from your bots)"
                disabled={removing === s.id}
                onClick={() => void remove(s.id, s.title)}
              >
                {removing === s.id ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <Trash2Icon />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
