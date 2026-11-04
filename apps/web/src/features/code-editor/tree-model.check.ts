import assert from "node:assert/strict";
import { buildTree } from "./tree-model";

const tree = buildTree([
  { path: "README.md", dir: false },
  { path: "src", dir: true },
  { path: "src/b.ts", dir: false },
  { path: "src/a.ts", dir: false },
  { path: "src/lib/x.ts", dir: false },
]);
assert.deepEqual(tree.map((n) => n.name), ["src", "README.md"], "folders before files");
const src = tree[0];
assert.deepEqual(src?.children.map((n) => n.name), ["lib", "a.ts", "b.ts"], "nested folders first, then files A to Z");
assert.equal(src?.children[0]?.dir, true, "a folder only known from a file path is still a folder");
assert.equal(src?.children[0]?.children[0]?.path, "src/lib/x.ts");
console.log("code tree: all checks passed");
