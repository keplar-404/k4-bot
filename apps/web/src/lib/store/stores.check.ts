import assert from "node:assert/strict";

/**
 * The Zustand stores against a fake API: a change made through one store reaches every store that shows it
 * (deleting a bot updates the bot list, the computer's accounts and the groups), and setters behave like useState's.
 */

type Route = (init: RequestInit | undefined) => unknown;
const calls: string[] = [];
let bots = [
  { id: "b1", name: "Writer", kind: "normal" },
  { id: "b2", name: "Researcher", kind: "normal" },
];
let accounts = [{ botId: "b1" }, { botId: "b2" }];
const routes: Record<string, Route> = {
  "GET /api/v1/bots": () => ({ bots }),
  "DELETE /api/v1/bots/b2": () => {
    bots = bots.filter((b) => b.id !== "b2");
    accounts = accounts.filter((a) => a.botId !== "b2");
    return { ok: true, computer: "removed" };
  },
  "GET /api/v1/computer/accounts": () => ({
    running: true,
    items: accounts.map((a) => ({ ...a, botName: a.botId, user: `u_${a.botId}`, home: "", exists: true, kb: 4 })),
    orphans: [],
  }),
  "GET /api/v1/groups": () => ({ groups: [] }),
  "POST /api/v1/groups": () => ({ group: { id: "g1", name: "Team", leadBotId: "b1", memory: "", members: [] } }),
  "DELETE /api/v1/groups/g1": () => ({ ok: true }),
  "GET /api/v1/files": () => ({ files: [{ id: "f1", name: "a.txt" }, { id: "f2", name: "b.txt" }], nextCursor: null }),
  "DELETE /api/v1/files/f1": () => ({ ok: true }),
};

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input));
  const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
  const key = `${method} ${url.pathname}`;
  calls.push(key);
  const route = routes[key];
  if (!route) return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 });
  return new Response(JSON.stringify(route(init)), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const { fieldSetter } = await import("./local-store");
const { createStore } = await import("zustand/vanilla");
const { useBotsStore } = await import("@/features/bots/store");
const { useBotsUiStore } = await import("@/features/bots/ui-store");
const { useAccountsStore } = await import("@/features/computer/accounts-store");
const { useGroupsStore } = await import("@/features/groups/store");
const { createGroup, deleteGroup } = await import("@/features/groups/api");
const { useComputerStore } = await import("@/features/computer/store");
const { useFilesStore } = await import("@/features/files/store");
const settle = () => new Promise((r) => setTimeout(r, 20));

// fieldSetter: same function per store and field; values and updaters both work.
const local = createStore<{ n: number }>()(() => ({ n: 1 }));
assert.equal(fieldSetter(local, "n"), fieldSetter(local, "n"));
fieldSetter(local, "n")(5);
fieldSetter(local, "n")((n) => n + 1);
assert.equal(local.getState().n, 6);

// Bots: one load serves every reader.
await useBotsStore.getState().load();
assert.deepEqual(useBotsStore.getState().bots.map((b) => b.id), ["b1", "b2"]);
assert.equal(useBotsStore.getState().loaded, true);

// Deleting from the VM page: the bot leaves the shared list, the accounts reload from the computer, groups reload.
await useAccountsStore.getState().load();
assert.equal(useAccountsStore.getState().data?.items.length, 2);
useBotsUiStore.getState().askDelete("b2");
assert.equal(useBotsUiStore.getState().confirming?.id, "b2");
let left: string | null = null;
await useBotsUiStore.getState().confirmDelete((bot) => {
  left = bot.id;
});
await settle();
assert.equal(left, "b2");
assert.equal(useBotsUiStore.getState().confirming, null);
assert.equal(useBotsUiStore.getState().deleting, false);
assert.deepEqual(useBotsStore.getState().bots.map((b) => b.id), ["b1"]);
assert.deepEqual(useAccountsStore.getState().data?.items.map((a) => a.botId), ["b1"]);
assert.ok(calls.includes("GET /api/v1/groups"), "groups reload after a bot is deleted");

// Sidebar dialog state.
useBotsUiStore.getState().openCreate();
assert.equal(useBotsUiStore.getState().dialogOpen, true);
useBotsUiStore.getState().setDialogOpen(false);
assert.equal(useBotsUiStore.getState().editingBot, null);

// Groups: a create or delete through the API is written to the shared store at once.
await createGroup({ name: "Team", botIds: ["b1", "b2"] });
assert.deepEqual(useGroupsStore.getState().groups?.map((g) => g.id), ["g1"]);
await deleteGroup("g1");
assert.deepEqual(useGroupsStore.getState().groups, []);

// Computer: status gives the session end, the activity feed keeps the last 50.
const before = Date.now();
useComputerStore.getState().applyStatus({ state: "running", session: { endsInMs: 60_000 } } as never);
assert.ok((useComputerStore.getState().sessionEndsAt ?? 0) >= before + 60_000);
for (let i = 0; i < 60; i++) useComputerStore.getState().pushActivity({ id: i } as never);
assert.equal(useComputerStore.getState().activity.length, 50);
assert.equal((useComputerStore.getState().activity.at(-1) as unknown as { id: number }).id, 59);

// Files: one list for the Files page and the pickers; a delete removes it from both.
await useFilesStore.getState().load(null);
assert.equal(useFilesStore.getState().files.length, 2);
useFilesStore.getState().setDeleting(useFilesStore.getState().files[0]!);
await useFilesStore.getState().confirmDelete();
assert.deepEqual(useFilesStore.getState().files.map((f) => f.id), ["f2"]);

console.log("stores: all checks passed");
