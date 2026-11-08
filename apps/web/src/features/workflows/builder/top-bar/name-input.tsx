"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { saveWorkflow } from "../../api";
import { useBuilder } from "../store";

/** The workflow's name, saved when the field loses focus or Enter is pressed (an empty name keeps the old one). */
export function NameInput() {
  const workflow = useBuilder((s) => s.workflow);
  const setWorkflow = useBuilder((s) => s.setWorkflow);
  const [value, setValue] = useState(workflow?.name ?? "");
  useEffect(() => setValue(workflow?.name ?? ""), [workflow?.name]);

  const commit = async () => {
    const name = value.trim().slice(0, 80);
    if (!workflow || !name || name === workflow.name)
      return setValue(workflow?.name ?? "");
    try {
      setWorkflow(await saveWorkflow(workflow.id, { name }));
    } catch (e) {
      toast.error((e as Error).message);
      setValue(workflow.name);
    }
  };

  return (
    <Input
      aria-label="Workflow name"
      value={value}
      maxLength={80}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="h-8 w-56 border-transparent bg-transparent font-medium shadow-none hover:border-input focus-visible:border-input md:w-72"
    />
  );
}
