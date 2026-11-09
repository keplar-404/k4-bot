import assert from "node:assert/strict";
import { pickAccount } from "./app-login";

const a = [
  { id: "ca_one", toolkit: "gmail", status: "ACTIVE", account: "me@work.com", createdAt: "" },
  { id: "ca_two", toolkit: "gmail", status: "ACTIVE", account: "me@home.com", createdAt: "" },
];
assert.equal(pickAccount(a, "2")?.id, "ca_two");
assert.equal(pickAccount(a, "Use me@work.com please")?.id, "ca_one");
assert.equal(pickAccount(a, "ca_two")?.id, "ca_two");
assert.equal(pickAccount(a, "3"), undefined);
assert.equal(pickAccount(a, "the other one"), undefined);
console.log("app-login ok");
