"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Light/dark switch: full text in the open sidebar, the icon alone when the sidebar is collapsed. */
export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = mounted
    ? isDark
      ? "Switch to light mode"
      : "Switch to dark mode"
    : "Toggle theme";

  return (
    <Button
      variant="outline"
      className="w-full cursor-pointer group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      <span className="group-data-[collapsible=icon]:hidden">{label}</span>
    </Button>
  );
}
