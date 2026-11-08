import assert from "node:assert/strict";
import { isRead } from "./action-kind";

// Composio's own tags decide first; a write tag beats a read tag; then the verb after the app prefix; unknown is a write.
assert.equal(isRead("GMAIL_FETCH_EMAILS", "gmail"), true);
assert.equal(isRead("GMAIL_LIST_LABELS", "gmail"), true);
assert.equal(isRead("GMAIL_SEND_EMAIL", "gmail"), false);
assert.equal(isRead("GMAIL_DELETE_MESSAGE", "gmail"), false);
assert.equal(isRead("GMAIL_FROBNICATE", "gmail"), false, "unknown means write");
assert.equal(isRead("GITHUB_GET_REPO", "gmail"), false, "a slug of another app is never read");
assert.equal(isRead("GOOGLE_CALENDAR_LIST_EVENTS", "google_calendar"), true, "app names with underscores");
assert.equal(isRead("GMAIL_SEND_EMAIL", "gmail", ["readOnlyHint"]), true, "a read-only tag wins over the verb");
assert.equal(
  isRead("GMAIL_FETCH_EMAILS", "gmail", ["readOnlyHint", "destructiveHint"]),
  false,
  "a write tag beats a read tag",
);
assert.equal(isRead("GMAIL_FETCH_EMAILS", "gmail", ["createHint"]), false);
console.log("action-kind: all checks passed");
