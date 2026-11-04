import assert from "node:assert/strict";
import type { WorkspaceTab } from "./types";
import { addTab, closeTab, INITIAL, MAX_FILE_TABS } from "./workspace-state";

const file = (n: number): WorkspaceTab => ({
  id: `f${n}`,
  kind: "file",
  title: `f${n}`,
  file: { id: `f${n}`, name: `f${n}`, mimeType: "text/plain" },
});

let s = addTab(INITIAL, file(1));
assert.equal(s.activeId, "f1", "an opened file is shown");
assert.equal(
  addTab(s, file(1)).tabs.length,
  s.tabs.length,
  "opening it again does not duplicate it",
);

for (let n = 2; n <= MAX_FILE_TABS + 1; n++) s = addTab(s, file(n));
assert.equal(
  s.tabs.filter((t) => t.kind === "file").length,
  MAX_FILE_TABS,
  "at most MAX_FILE_TABS file tabs",
);
assert.ok(!s.tabs.some((t) => t.id === "f1"), "the oldest one closed");

const shown = { ...s, activeId: "f5" };
assert.equal(
  closeTab(shown, "f3").activeId,
  "f5",
  "closing a background tab keeps the shown one",
);
assert.equal(
  closeTab(shown, "f5").activeId,
  "f4",
  "closing the shown tab shows the one before it",
);
assert.equal(closeTab(shown, "computer"), shown, "fixed tabs cannot be closed");

console.log("workspace tabs: all checks passed");
