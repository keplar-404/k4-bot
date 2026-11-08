"use client";

import { useState } from "react";
import type { ExpressionId } from "@/features/avatar/bloub/bot/expressions";
import {
  type ColorId,
  SHAPES,
  type ShapeId,
} from "@/features/avatar/bloub/bot/skins";
import type { RoleId } from "@/features/bots/roles";
import { DEFAULT_ROLE } from "@/features/bots/roles";

export function useBotFormFields() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState<RoleId>(DEFAULT_ROLE);
  const [roleTitle, setRoleTitle] = useState("");
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [mcpServerIds, setMcpServerIds] = useState<string[]>([]);
  const [composioToolkits, setComposioToolkits] = useState<string[]>([]);
  const [composioAllowWrites, setComposioAllowWrites] = useState<
    Record<string, boolean>
  >({});
  const [shape, setShape] = useState<ShapeId>(SHAPES[0].id);
  const [color, setColor] = useState<ColorId>("encre");
  const [expression, setExpression] = useState<ExpressionId>("neutre");
  return {
    name,
    setName,
    description,
    setDescription,
    role,
    setRole,
    roleTitle,
    setRoleTitle,
    skillIds,
    setSkillIds,
    mcpServerIds,
    setMcpServerIds,
    composioToolkits,
    setComposioToolkits,
    composioAllowWrites,
    setComposioAllowWrites,
    shape,
    setShape,
    color,
    setColor,
    expression,
    setExpression,
    SHAPES,
  };
}
