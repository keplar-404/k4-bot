import { Badge } from "@/components/ui/badge";
import { roleLabel } from "@/features/bots/roles";
import type { SkillRole } from "@/features/integrations/api";

export const publisher = (id: string) => id.split("/")[0] ?? "";

export function RoleBadge({ role }: { role: SkillRole | null }) {
  if (!role) return null;
  return (
    <Badge variant="secondary" className="shrink-0">
      {roleLabel(role)}
    </Badge>
  );
}
