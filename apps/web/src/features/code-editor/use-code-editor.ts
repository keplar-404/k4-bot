"use client";

import { useCallback, useEffect, useRef } from "react";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";
import { listTree, readFile, type TreeEntry } from "./api";
import type { Doc, TerminalLine } from "./types";
import { useDocSave } from "./use-doc-save";
import { type SandboxEvent, useSandboxSocket } from "./use-sandbox-socket";

export type { Doc, TerminalLine } from "./types";

const MAX_LINES = 50;

/**
 * The editor's state: tree, open file (its saved version, the user's draft and the version hash), the terminal, and
 * what to do when the agent changes things. An agent edit of the open file reloads it when the user has no unsaved
 * changes; otherwise `stale` asks the user whether to reload.
 */
export function useCodeEditor(botId: string) {
  const [{ tree, doc, stale, terminal, error }, , store] = useLocalStore(
    () => ({
      tree: [] as TreeEntry[],
      doc: null as Doc | null,
      stale: false,
      terminal: [] as TerminalLine[],
      error: null as string | null,
    }),
  );
  const setTree = fieldSetter(store, "tree");
  const setDoc = fieldSetter(store, "doc");
  const setStale = fieldSetter(store, "stale");
  const setTerminal = fieldSetter(store, "terminal");
  const setError = fieldSetter(store, "error");
  const docRef = useRef(doc);
  docRef.current = doc;
  const treeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refreshTree = useCallback(
    () =>
      listTree(botId)
        .then(setTree)
        .catch((e: Error) => setError(e.message)),
    [botId, setError, setTree],
  );
  const open = useCallback(
    async (path: string) => {
      try {
        const f = await readFile(botId, path);
        setDoc({
          path: f.path,
          saved: f.content,
          text: f.content,
          hash: f.hash,
        });
        setStale(false);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [botId, setDoc, setError, setStale],
  );

  const onEvent = useCallback(
    (e: SandboxEvent) => {
      if (e.type === "exec")
        setTerminal((t) => [...t.slice(-(MAX_LINES - 1)), e]);
      if (e.type !== "file.changed") return;
      // Many writes in a row (an install, a generator) refresh the tree once.
      clearTimeout(treeTimer.current);
      treeTimer.current = setTimeout(() => void refreshTree(), 800);
      const d = docRef.current;
      if (!d || d.path !== e.path || e.by === "user") return;
      if (d.text === d.saved) void open(d.path);
      else setStale(true);
    },
    [open, refreshTree, setStale, setTerminal],
  );
  const socket = useSandboxSocket(botId, onEvent);

  useEffect(() => {
    if (socket.state === "open") void refreshTree();
  }, [socket.state, refreshTree]);

  const { save, overwrite } = useDocSave(
    botId,
    docRef,
    setDoc,
    setStale,
    setError,
  );
  const edit = (text: string) => setDoc((d) => (d ? { ...d, text } : d));
  return {
    socket,
    tree,
    doc,
    stale,
    terminal,
    error,
    open,
    edit,
    save,
    overwrite,
    refreshTree,
  };
}
