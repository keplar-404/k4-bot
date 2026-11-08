"use client";

import { useEffect, useState } from "react";
import { type Category, fetchCategories } from "./api";

/** The category filter's options (an empty list when they cannot load: the filter just offers "All"). */
export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);
  return categories;
}
