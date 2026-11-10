"use client";

import { CheckIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type CatalogSkill, installSkill } from "@/features/integrations/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/** + to install, a check once installed, a spinner while it runs. */
export function InstallButton({
  skill,
  size = "icon-sm",
}: {
  skill: CatalogSkill;
  size?: "icon-sm" | "sm";
}) {
  const [{ busy }, , store] = useLocalStore(() => ({
    busy: false,
  }));
  const setBusy = fieldSetter(store, "busy");
  const installed = Boolean(skill.installedId);
  const install = async () => {
    setBusy(true);
    try {
      await installSkill(skill.id);
      toast.success(`Installed ${skill.name}`, {
        description: "Add it to a bot when you create or edit the bot.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (size === "sm")
    return (
      <Button
        size="sm"
        disabled={installed || busy}
        onClick={() => void install()}
      >
        {busy ? (
          <Loader2Icon className="animate-spin" />
        ) : installed ? (
          <CheckIcon />
        ) : (
          <PlusIcon />
        )}
        {installed ? "Installed" : busy ? "Installing…" : "Install"}
      </Button>
    );
  return (
    <Button
      size="icon-sm"
      variant={installed ? "ghost" : "outline"}
      disabled={installed || busy}
      aria-label={
        installed ? `${skill.name} is installed` : `Install ${skill.name}`
      }
      title={installed ? "Installed" : "Install"}
      onClick={(e) => {
        e.stopPropagation();
        void install();
      }}
    >
      {busy ? (
        <Loader2Icon className="animate-spin" />
      ) : installed ? (
        <CheckIcon />
      ) : (
        <PlusIcon />
      )}
    </Button>
  );
}
