import assert from "node:assert/strict";
import { addressed, memberNamed } from "./mentions";

const r = { id: "r", name: "Researcher" };
const w = { id: "w", name: "Story Writer" };
const all = [r, w];
assert.deepEqual(addressed("hi", all, r), [r]);
assert.deepEqual(addressed("@bot:story-writer draft, then @bot:researcher check. @bot:Story_Writer again", all, r), [w, r]);
assert.deepEqual(addressed("@bot:nobody hello", all, w), [w]);
assert.deepEqual(addressed("mail me@bot.com", all, r), [r]);
assert.equal(memberNamed(all, "@bot:researcher"), r);
assert.equal(memberNamed(all, "Story Writer"), w);
assert.equal(memberNamed(all, "ghost"), undefined);
console.log("mentions ok");
