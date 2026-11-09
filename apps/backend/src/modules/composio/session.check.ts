import assert from "node:assert/strict";
import { connectCallback } from "./session";

const web = "https://app.example.com";
assert.equal(connectCallback(web, "gmail"), "https://app.example.com/dashboard/connect?connected=gmail");
assert.equal(
  connectCallback(web, "gmail", "/workflows/abc-123"),
  "https://app.example.com/workflows/abc-123?connected=gmail",
);
// Never another site, never a path outside the app's pages.
for (const bad of [
  "https://evil.com",
  "//evil.com/workflows/x",
  "/\\evil.com",
  "/api/v1/auth/sign-out",
  "/workflows/../api",
  "/workflows/x?y=1",
  "javascript:alert(1)",
]) {
  assert.equal(connectCallback(web, "gmail", bad), "https://app.example.com/dashboard/connect?connected=gmail", bad);
}
console.log("connect callback: all checks passed");
