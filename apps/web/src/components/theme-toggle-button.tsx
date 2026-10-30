"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      className="w-full cursor-pointer"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted
        ? isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
        : "Toggle theme"}
    </Button>
  );
}
