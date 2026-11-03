import { toast } from "sonner";
import type { ExpressionId } from "@/features/avatar/bloub/bot/expressions";
import type { ColorId, ShapeId } from "@/features/avatar/bloub/bot/skins";
import type { CreateBotInput } from "@/features/bots/api";
import type { Capabilities } from "@/features/bots/components/bot-capabilities";
import type { RoleId } from "@/features/bots/roles";

export interface SubmitDeps {
  name: string;
  description: string;
  role: RoleId;
  roleTitle: string;
  skillIds: string[];
  mcpServerIds: string[];
  caps: Capabilities;
  shape: ShapeId;
  color: ColorId;
  setOpen: (open: boolean) => void;
  setSubmitting: (v: boolean) => void;
  setExpression: (e: ExpressionId) => void;
  onSubmit: (input: CreateBotInput) => Promise<unknown>;
  submitting: boolean;
  isEditing: boolean;
}

export async function submitBot(deps: SubmitDeps): Promise<void> {
  if (deps.submitting) return;
  if (deps.role === "custom" && !deps.roleTitle.trim()) {
    toast.error("Name the custom role, or pick one of the others.");
    return;
  }
  deps.setSubmitting(true);
  deps.setExpression("heureux");
  try {
    await deps.onSubmit({
      name: deps.name || "Untitled bot",
      description: deps.description,
      role: deps.role,
      ...(deps.role === "custom" ? { roleTitle: deps.roleTitle.trim() } : {}),
      skillIds: deps.skillIds,
      mcpServerIds: deps.mcpServerIds,
      ...deps.caps,
      shape: deps.shape,
      color: deps.color,
      expression: "neutre",
    });
    deps.setOpen(false);
  } catch (e) {
    console.error("bot submit failed", e);
    toast.error(
      e instanceof Error
        ? e.message
        : "Something went wrong. Please try again.",
    );
  } finally {
    deps.setSubmitting(false);
    setTimeout(() => deps.setExpression("neutre"), 1500);
  }
}
