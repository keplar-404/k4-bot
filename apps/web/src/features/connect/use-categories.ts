"use client";

import { useEffect } from "react";
import type { Category } from "./api";
import { useConnectStore } from "./store";

const NONE: Category[] = [];

/** The category filter's options, loaded once and shared (an empty list when they cannot load). */
export function useCategories(): Category[] {
  const categories = useConnectStore((s) => s.categories);
  const load = useConnectStore((s) => s.loadCategories);
  useEffect(() => void load(), [load]);
  return categories ?? NONE;
}
