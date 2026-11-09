"use client";

import { Button } from "@/components/ui/button";
import { AppLogo } from "@/features/connect/components/app-logo";
import { logoOf } from "../../describe";
import { appName } from "../block-label";

/** The app a block uses, with a way to pick another one (which clears what depended on it). */
export function ChosenApp({
  toolkit,
  onChange,
}: {
  toolkit: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-2">
      <AppLogo src={logoOf(toolkit)} name={toolkit} size="sm" />
      <span className="min-w-0 flex-1 truncate font-medium text-sm">
        {appName(toolkit)}
      </span>
      <Button size="xs" variant="outline" onClick={onChange}>
        Change
      </Button>
    </div>
  );
}
