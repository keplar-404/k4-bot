"use client";

import { type SetStateAction, useRef } from "react";
import { type StoreApi, useStore } from "zustand";
import { createStore } from "zustand/vanilla";

/**
 * A Zustand store owned by one component instance (one chat view, one editor, one bot's panel): its state is read
 * reactively, and `set` writes it like any store (partial object or updater). Shared app data lives in the
 * feature stores (`features/<name>/store.ts`) instead.
 */
export function useLocalStore<T extends object>(init: () => T) {
  const ref = useRef<StoreApi<T> | null>(null);
  ref.current ??= createStore<T>()(init);
  const store = ref.current;
  const state = useStore(store);
  return [state, store.setState, store] as const;
}

const setters = new WeakMap<object, Map<PropertyKey, unknown>>();

/**
 * A setter with useState's signature (value or updater) that writes one field of a store. The same function is
 * returned for the same store and field, so it is safe in effect and callback dependencies.
 */
export function fieldSetter<T extends object, K extends keyof T>(
  store: StoreApi<T>,
  key: K,
): (value: SetStateAction<T[K]>) => void {
  let byKey = setters.get(store);
  if (!byKey) {
    byKey = new Map();
    setters.set(store, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit as (value: SetStateAction<T[K]>) => void;
  const set = (value: SetStateAction<T[K]>) =>
    store.setState(
      (s) =>
        ({
          [key]:
            typeof value === "function"
              ? (value as (prev: T[K]) => T[K])(s[key])
              : value,
        }) as unknown as Partial<T>,
    );
  byKey.set(key, set);
  return set;
}
