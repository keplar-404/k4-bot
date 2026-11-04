import assert from "node:assert/strict";
import { homePath, parseTree } from "./paths";

assert.equal(homePath("app/index.js"), "/home/user/app/index.js", "relative paths are under home");
assert.equal(homePath("/home/user/a/../b.txt"), "/home/user/b.txt");
assert.equal(homePath("../../etc/passwd"), null, "cannot climb out of home");
assert.equal(homePath("/etc/passwd"), null);
assert.equal(homePath("/home/username/x"), null, "a sibling with the same prefix is not home");
assert.deepEqual(parseTree("d /home/user/src\nf /home/user/src/a.ts\nf /home/user/README.md\n"), [
  { dir: false, path: "README.md" },
  { dir: true, path: "src" },
  { dir: false, path: "src/a.ts" },
]);
console.log("sandbox paths: all checks passed");
