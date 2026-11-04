/**
 * Coding eval tasks. Each: files put in the sandbox first, the prompt the coding bot gets, and a check command run
 * afterwards (exit 0 = pass). Checks may add hidden test files the bot never saw, so passing means the work is right,
 * not just that it ran its own tests. Plain Node (no installs), so a task is quick and its outcome is the bot's.
 */
export interface EvalTask {
  id: string;
  prompt: string;
  files: Record<string, string>;
  /** Files written only at check time (hidden tests). */
  hidden?: Record<string, string>;
  check: string;
}

const ASSERT = "const assert = require('node:assert/strict');";

export const TASKS: EvalTask[] = [
  {
    id: "fix-bug",
    prompt: "In /home/user/proj, `node test.js` fails. Find and fix the bug in sum.js (do not change test.js). Then confirm the tests pass.",
    files: {
      "proj/sum.js": "function sumRange(a, b) {\n  let total = 0;\n  for (let i = a; i < b; i++) total += i;\n  return total;\n}\nmodule.exports = { sumRange };\n",
      "proj/test.js": `${ASSERT}\nconst { sumRange } = require('./sum');\nassert.equal(sumRange(1, 3), 6);\nassert.equal(sumRange(5, 5), 5);\nconsole.log('ok');\n`,
    },
    check: "cd /home/user/proj && node test.js",
  },
  {
    id: "implement-spec",
    prompt:
      "In /home/user/proj create slug.js exporting `slugify(text)` (CommonJS, module.exports = { slugify }): lowercase, trim, replace every run of non-letters/digits with a single '-', and no leading or trailing '-'. Example: '  Hello, World!  ' -> 'hello-world'. Write your own tests and run them.",
    files: { "proj/README.md": "# Slug utility\n" },
    hidden: { "proj/hidden.test.js": `${ASSERT}\nconst { slugify } = require('./slug');\nassert.equal(slugify('  Hello, World!  '), 'hello-world');\nassert.equal(slugify('a__b--c'), 'a-b-c');\nassert.equal(slugify('Big   gaps\\tand\\nlines'), 'big-gaps-and-lines');\nassert.equal(slugify('---'), '');\nassert.equal(slugify('ABC123'), 'abc123');\nconsole.log('ok');\n` },
    check: "cd /home/user/proj && node hidden.test.js",
  },
  {
    id: "refactor-keep-behaviour",
    prompt: "In /home/user/proj, calc.js repeats the same validation in add, sub and mul. Refactor it so the validation lives in one helper, without changing behaviour. `node test.js` must still pass.",
    files: {
      "proj/calc.js":
        "function add(a, b) {\n  if (typeof a !== 'number' || typeof b !== 'number') throw new TypeError('numbers only');\n  return a + b;\n}\nfunction sub(a, b) {\n  if (typeof a !== 'number' || typeof b !== 'number') throw new TypeError('numbers only');\n  return a - b;\n}\nfunction mul(a, b) {\n  if (typeof a !== 'number' || typeof b !== 'number') throw new TypeError('numbers only');\n  return a * b;\n}\nmodule.exports = { add, sub, mul };\n",
      "proj/test.js": `${ASSERT}\nconst c = require('./calc');\nassert.equal(c.add(2, 3), 5);\nassert.equal(c.sub(2, 3), -1);\nassert.equal(c.mul(2, 3), 6);\nassert.throws(() => c.add('2', 3), TypeError);\nconsole.log('ok');\n`,
    },
    // Behaviour kept, and the repeated check is gone (it appears at most once).
    check: "cd /home/user/proj && node test.js && [ $(grep -c \"typeof a !== 'number'\" calc.js) -le 1 ]",
  },
  {
    id: "build-cli",
    prompt: "Create /home/user/proj/wc.js: `node wc.js <file>` prints the number of words in the file (words are separated by any whitespace) and nothing else. Exit with code 1 and a message on stderr when the file does not exist.",
    files: { "proj/sample.txt": "one two  three\nfour\tfive\n\nsix\n" },
    check: "cd /home/user/proj && [ \"$(node wc.js sample.txt)\" = \"6\" ] && ! node wc.js missing.txt 2>/dev/null",
  },
  {
    id: "read-and-answer",
    prompt: "Look through the project in /home/user/proj and find which port the server listens on when no PORT environment variable is set. Write just the number to /home/user/proj/answer.txt.",
    files: {
      "proj/src/config.js": "const defaults = { port: 8080, host: '0.0.0.0' };\nmodule.exports = { port: Number(process.env.PORT ?? defaults.port), host: defaults.host };\n",
      "proj/src/server.js": "const { port } = require('./config');\nrequire('node:http').createServer((q, r) => r.end('hi')).listen(port);\n",
      "proj/docs/old-notes.md": "We used to run on 3000 in 2024.\n",
    },
    check: "[ \"$(tr -d '[:space:]' < /home/user/proj/answer.txt)\" = \"8080\" ]",
  },
];
