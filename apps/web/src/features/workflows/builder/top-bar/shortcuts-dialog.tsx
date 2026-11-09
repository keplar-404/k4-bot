"use client";

import { KeyboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { usePanels } from "../panels-store";
import { isMac, SHORTCUTS } from "../shortcuts";

/** The list of shortcuts (⌘K / Ctrl+K, or the keyboard button in the top bar). */
export function ShortcutsDialog() {
  const open = usePanels((s) => s.shortcuts);
  const setOpen = (v: boolean) => usePanels.getState().toggle("shortcuts", v);
  const mod = isMac() ? "⌘" : "Ctrl";
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
        title={`Keyboard shortcuts (${mod} K)`}
      >
        <KeyboardIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Shortcuts do nothing while you type in a field. Changes save on
              their own.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {SHORTCUTS.map((section) => (
              <section key={section.group} className="flex flex-col gap-1.5">
                <h3 className="font-medium text-muted-foreground text-xs">
                  {section.group}
                </h3>
                {section.items.map((item) => (
                  <div
                    key={item.what}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{item.what}</span>
                    <KbdGroup>
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k === "Mod" ? mod : k}</Kbd>
                      ))}
                    </KbdGroup>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
