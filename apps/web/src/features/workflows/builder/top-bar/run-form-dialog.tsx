"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BlockBody } from "../blocks";

type FormField = Extract<
  BlockBody,
  { kind: "trigger.manual" }
>["config"]["fields"][number];

/** The manual trigger's form before a run. Values are typed and checked again on the server. */
export function RunFormDialog({
  fields,
  open,
  busy,
  onOpenChange,
  onRun,
}: {
  fields: FormField[];
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (inputs: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (open) setValues({});
  }, [open]);
  const missing = fields.filter(
    (f) =>
      f.required && f.type !== "yes_no" && !String(values[f.key] ?? "").trim(),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run</DialogTitle>
          <DialogDescription>
            Fill in the form. It runs your draft for real, so apps are really
            called.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {fields.map((f) => {
            const id = `run-${f.key}`;
            const label = `${f.label || f.key}${f.required ? " *" : ""}`;
            if (f.type === "yes_no")
              return (
                <div key={f.key} className="flex items-center justify-between">
                  <Label htmlFor={id}>{label}</Label>
                  <Switch
                    id={id}
                    checked={values[f.key] === true}
                    onCheckedChange={(v) =>
                      setValues({ ...values, [f.key]: v })
                    }
                  />
                </div>
              );
            return (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  type={f.type === "number" ? "number" : "text"}
                  placeholder={
                    f.type === "list" ? "Separate items with commas" : f.help
                  }
                  value={String(values[f.key] ?? "")}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          {missing.length > 0 && (
            <span className="mr-auto self-center text-xs text-muted-foreground">
              Fill in {missing.map((f) => f.label || f.key).join(", ")}.
            </span>
          )}
          <Button
            disabled={busy || missing.length > 0}
            onClick={() => onRun(values)}
          >
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
