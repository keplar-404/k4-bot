// bun run src/modules/memory/auto/validate.check.ts
import assert from "node:assert/strict";
import { acceptable, looksSecret } from "./validate";

assert.ok(looksSecret("my key is sk-proj-abcdefghijklmnop1234"));
assert.ok(looksSecret("password: hunter22x"));
assert.ok(looksSecret("card 4111 1111 1111 1111"));
assert.ok(!looksSecret("- Prefers short answers in Bangla\n- Works on the K4 launch"));
assert.ok(acceptable("- Prefers short answers", "", 4000));
assert.ok(!acceptable("- Prefers short answers", "- Prefers short answers", 4000), "unchanged");
assert.ok(!acceptable("x".repeat(5000), "", 4000), "too long");
assert.ok(!acceptable("- token: ghp_abcdefghijklmnopqrstuv", "", 4000), "secret");
assert.ok(!acceptable("- new", "- a long existing memory line\n".repeat(20), 8000), "drops most of the memory");
assert.ok(!acceptable(null, "x", 100));
console.log("auto memory validate: all checks passed");
