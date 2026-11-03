import type { RoleId } from "@backend/lib/bot-roles";
import {
  BrainCircuitIcon,
  CodeXmlIcon,
  CompassIcon,
  PenLineIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

export type { RoleId };

/** Longest custom role title (the server enforces the same). */
export const MAX_ROLE_TITLE = 60;

export const DEFAULT_ROLE: RoleId = "assistant";

/** The ids come from the backend (apps/backend/src/lib/bot-roles.ts), which also writes the role into the prompt. */
export const ROLES: Array<{
  id: RoleId;
  label: string;
  description: string;
  icon: typeof BrainCircuitIcon;
}> = [
  {
    id: "assistant",
    label: "Assistant",
    description: "Everyday help with anything",
    icon: BrainCircuitIcon,
  },
  {
    id: "advisor",
    label: "Advisor",
    description: "Weighs options and recommends",
    icon: CompassIcon,
  },
  {
    id: "coding",
    label: "Coding",
    description: "Writes, debugs and reviews code",
    icon: CodeXmlIcon,
  },
  {
    id: "research",
    label: "Research",
    description: "Searches, compares and cites sources",
    icon: SearchIcon,
  },
  {
    id: "writing",
    label: "Writing",
    description: "Drafts and polishes text",
    icon: PenLineIcon,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Name your own role",
    icon: SlidersHorizontalIcon,
  },
];

/** The role as a short label: "Coding", or the user's own title for a custom role. */
export function roleLabel(role: string | undefined, roleTitle?: string | null) {
  if (role === "custom") return roleTitle?.trim() || "Custom";
  return ROLES.find((r) => r.id === role)?.label ?? "Assistant";
}
