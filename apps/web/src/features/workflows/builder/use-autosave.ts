"use client";

import { useEffect, useRef } from "react";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { saveWorkflow, type WorkflowApiError } from "../api";
import { flowToGraph } from "./flow";
import { useBuilder } from "./store";

export type SaveState = "saved" | "unsaved" | "saving" | "error" | "conflict";

const DELAY_MS = 900;

/**
 * Saves the draft ~1 s after the last change. Each save carries the version it was based on, so a newer save from
 * another tab is never overwritten (the server answers 409 and this tab asks for a reload). Closing the tab with
 * unsaved changes asks first.
 */
export function useAutosave() {
  const version = useBuilder((s) => s.version);
  const [{ state, message, tick }, , store] = useLocalStore(() => ({
    state: "saved" as SaveState,
    message: null as string | null,
    tick: 0,
  }));
  const setState = fieldSetter(store, "state");
  const setMessage = fieldSetter(store, "message");
  const setTick = fieldSetter(store, "tick");
  /** Re-runs the save after one finishes, for changes made while it was in flight. */
  const saving = useRef(false);
  const saved = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` only re-runs the save
  useEffect(() => {
    if (version === saved.current) return;
    // The assistant holds the workflow: the server refuses edits meanwhile, and the canvas shows its draft.
    if (useBuilder.getState().lockedBy) return;
    setState("unsaved");
    const t = setTimeout(async () => {
      if (saving.current) return;
      const {
        workflow,
        nodes,
        edges,
        version: v,
        setWorkflow,
        pins,
      } = useBuilder.getState();
      if (!workflow) return;
      saving.current = true;
      setState("saving");
      try {
        const next = await saveWorkflow(workflow.id, {
          graph: {
            ...flowToGraph(nodes, edges),
            ...(Object.keys(pins).length ? { pins } : {}),
          },
          expectedUpdatedAt: workflow.updatedAt,
        });
        setWorkflow(next);
        saved.current = v;
        setMessage(null);
        const changedMeanwhile = useBuilder.getState().version !== v;
        setState(changedMeanwhile ? "unsaved" : "saved");
        if (changedMeanwhile) setTick((n) => n + 1);
      } catch (e) {
        const err = e as WorkflowApiError;
        setMessage(err.message);
        setState(err.code === "CONFLICT" ? "conflict" : "error");
      } finally {
        saving.current = false;
      }
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [version, tick]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (useBuilder.getState().version !== saved.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Other parts of the builder ("Test this step") need to know the server has the latest draft.
  useEffect(() => useBuilder.setState({ saved: state === "saved" }), [state]);
  return { state, message };
}
