import assert from "node:assert/strict";
import { lockHolds } from "./lock";

// The canvas stays read-only only while the assistant's run is still going; anything else is a stale lock.
for (const s of ["queued", "running", "waiting"]) assert.ok(lockHolds(s), `${s} holds the lock`);
for (const s of ["succeeded", "failed", "cancelled", null, undefined]) assert.ok(!lockHolds(s), `${s} does not`);

console.log("lock: ok");
