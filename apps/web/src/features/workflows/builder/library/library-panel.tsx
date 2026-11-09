"use client";

import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { BUILT_IN } from "../block-catalog";
import { usePanels } from "../panels-store";
import { useBuilder } from "../store";
import { LibraryApps } from "./library-apps";
import { LibraryItem, LibrarySection } from "./library-item";

/** The floating block library on the left: triggers, logic, and every app. It folds to a button. */
export function LibraryPanel() {
  const open = usePanels((s) => s.library);
  const setOpen = (v: boolean) => usePanels.getState().toggle("library", v);
  const [query, setQuery] = useState("");
  const addBlock = useBuilder((s) => s.addBlock);
  const q = query.trim().toLowerCase();
  const builtIns = BUILT_IN.filter(
    (b) => !q || `${b.title} ${b.hint}`.toLowerCase().includes(q),
  );

  if (!open) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="absolute top-3 left-3 z-10 shadow-sm"
        onClick={() => setOpen(true)}
        aria-label="Show blocks"
        title="Show blocks ( [ )"
      >
        <PanelLeftOpenIcon />
      </Button>
    );
  }
  return (
    <aside
      className="absolute top-3 bottom-3 left-3 z-10 flex w-72 flex-col overflow-hidden rounded-xl border bg-card/95 shadow-lg backdrop-blur"
      aria-label="Blocks"
    >
      <div className="flex items-center gap-2 border-b p-2">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocks and apps"
            aria-label="Search blocks and apps"
            maxLength={80}
          />
        </InputGroup>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(false)}
          aria-label="Hide blocks"
        >
          <PanelLeftCloseIcon />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {(["Triggers", "Logic"] as const).map((group) => {
          const items = builtIns.filter((b) => b.group === group);
          if (items.length === 0) return null;
          return (
            <LibrarySection key={group} title={group}>
              {items.map((b) => (
                <LibraryItem
                  key={b.kind}
                  payload={{ kind: b.kind }}
                  icon={
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <b.icon className="size-4" />
                    </span>
                  }
                  title={b.title}
                  hint={b.hint}
                  onAdd={() => addBlock(b.kind)}
                />
              ))}
            </LibrarySection>
          );
        })}
        <LibraryApps query={query} />
      </div>
    </aside>
  );
}
