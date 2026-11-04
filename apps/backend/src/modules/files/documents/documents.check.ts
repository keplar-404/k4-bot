import assert from "node:assert/strict";
import { parsePages, ranges } from "./pages";
import { splitPages } from "./pdf-parse";

assert.deepEqual(parsePages("", 3), [1, 2, 3], "empty = every page");
assert.deepEqual(parsePages("2,5-7,6,99", 8), [2, 5, 6, 7], "ranges, repeats and out-of-range pages");
assert.deepEqual(parsePages("x", 8), [], "garbage asks for nothing");
assert.equal(ranges([1, 2, 3, 7, 9, 10]), "1-3,7,9-10");

const parsed = '<file name="a.pdf">\n# a.pdf\n## Metadata\n- Title=x\n## Contents\n### Page 1\nHello\n\n### Page 2\n\n### Page 3\nBye\n</file>';
assert.deepEqual(splitPages(parsed), ["Hello", "", "Bye"], "pages split, metadata dropped, empty scan page kept");

console.log("documents: all checks passed");