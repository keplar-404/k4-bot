"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataPicker } from "./data-picker";

/** The "+" in a template field: opens the data picker and inserts the chosen field at the cursor. */
export function DataPickerButton({
  onPick,
}: {
  onPick: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Insert data from an earlier step"
        title="Insert data from an earlier step"
      >
        <PlusIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2">
        <DataPicker
          onPick={(path) => {
            setOpen(false);
            onPick(path);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
