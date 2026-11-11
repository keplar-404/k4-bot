import assert from "node:assert/strict";
import { rankActions } from "./search";

// The searches the assistant really made: a phrase must find the action that has most of its words.
const actions = [
  { slug: "GMAIL_FETCH_MESSAGE_BY_THREAD_ID", name: "Fetch Message by Thread ID", description: "Retrieves messages from a thread." },
  { slug: "GMAIL_SEND_EMAIL", name: "Send email", description: "Sends an email." },
  { slug: "GMAIL_FETCH_EMAILS", name: "Fetch emails", description: "Lists Gmail messages with query and label filtering." },
];
const first = (q: string) => rankActions(actions, q)[0]?.slug;

assert.equal(first("list messages emails"), "GMAIL_FETCH_EMAILS");
assert.ok(rankActions(actions, "fetch messages").slice(0, 2).some((a) => a.slug === "GMAIL_FETCH_EMAILS"), "both fetch actions rank first");
assert.equal(first("send an email"), "GMAIL_SEND_EMAIL");
assert.equal(first("thread messages"), "GMAIL_FETCH_MESSAGE_BY_THREAD_ID");
assert.deepEqual(rankActions(actions, "calendar"), [], "nothing matches");
assert.equal(rankActions(actions, "a").length, 3, "an empty search lists the first actions");

console.log("assistant search: ok");
