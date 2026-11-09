import assert from "node:assert/strict";
import { publishIssues } from "./validate";

// Publishing rules: secrets only in app/HTTP blocks, delays at most 7 days in total
const trigger = { id: "t", kind: "trigger.manual", position: { x: 0, y: 0 }, config: {} };
const withSet = (value: string) =>
  ({
    nodes: [
      trigger,
      { id: "s", kind: "logic.set", position: { x: 0, y: 0 }, config: { fields: [{ key: "k", value }] } },
    ],
    edges: [{ id: "e", source: "t", target: "s" }],
  }) as never;
assert.ok(publishIssues(withSet("{{secrets.API_KEY}}")).some((i) => /Secrets can only/.test(i.message)));
assert.equal(publishIssues(withSet("plain")).length, 0);

const twoDelays = (days: number) =>
  ({
    nodes: [
      trigger,
      ...["d1", "d2"].map((id) => ({
        id,
        kind: "logic.delay",
        position: { x: 0, y: 0 },
        config: { amount: days, unit: "days" },
      })),
    ],
    edges: [
      { id: "e1", source: "t", target: "d1" },
      { id: "e2", source: "d1", target: "d2" },
    ],
  }) as never;
assert.ok(
  publishIssues(twoDelays(4)).some((i) => /together/.test(i.message)),
  "two 4-day delays are over 7 days",
);
assert.equal(publishIssues(twoDelays(3)).length, 0);

// App events and AI steps must be filled in; a secret can never reach a bot's prompt.
const withBlock = (node: object) =>
  ({
    nodes: [trigger, { position: { x: 0, y: 0 }, ...node }],
    edges: [{ id: "e", source: "t", target: "x" }],
  }) as never;
const firstIssue = (g: never) => publishIssues(g)[0]?.message ?? "";
const appEvent = (config: object) =>
  ({
    nodes: [
      { id: "t", kind: "trigger.app", position: { x: 0, y: 0 }, config: { config: {}, ...config } },
      { id: "x", kind: "logic.set", position: { x: 0, y: 0 }, config: { fields: [] } },
    ],
    edges: [{ id: "e", source: "t", target: "x" }],
  }) as never;
assert.match(firstIssue(appEvent({})), /Choose an app and the event/);
assert.equal(publishIssues(appEvent({ toolkit: "slack", trigger: "SLACK_CHANNEL_MESSAGE_RECEIVED" })).length, 0);
const ai = (config: object) =>
  withBlock({
    id: "x",
    kind: "ai.bot",
    onError: "stop",
    config: { prompt: "", output: "text", useApps: false, ...config },
  });
assert.match(firstIssue(ai({})), /Choose the bot/);
assert.match(firstIssue(ai({ botId: "b1" })), /Say what the bot should do/);
assert.match(firstIssue(ai({ botId: "b1", prompt: "Use {{secrets.API_KEY}}" })), /Secrets can only/);
assert.equal(publishIssues(ai({ botId: "b1", prompt: "Sum up {{trigger.inputs.text}}" })).length, 0);

console.log("publish rules: all checks passed");
