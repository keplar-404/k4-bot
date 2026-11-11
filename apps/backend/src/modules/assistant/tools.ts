import { interrupt } from "@langchain/langgraph";
import { eq } from "drizzle-orm";
import { tool } from "langchain";
import { z } from "zod";
import type { Env } from "../../config/env";
import type { Db } from "../../db";
import { bot } from "../../db/schema";
import { asText, describeWorkflow } from "../agent/workflows/common";
import { waitForRun } from "../agent/workflows/wait";
import { searchCatalog } from "../composio/catalog-query";
import { isRead } from "../composio/action-kind";
import { composioFor, TOOLKIT_SLUG } from "../composio/client";
import { executeAction } from "../composio/execute";
import { userSession } from "../composio/session";
import { missingApps, toolkitsOf } from "../composio/requirements";
import { getTool, listTools } from "../composio/tools";
import { getTriggerType, listTriggerTypes } from "../composio/triggers";
import { RunStartError, startRun } from "../workflows/engine/start";
import { triggerInput } from "../workflows/engine/trigger-input";
import { toPortable } from "../workflows/graph/portable";
import { graphSchema, type NodeKind, nodeSchema } from "../workflows/graph/schema";
import { triggerOf } from "../workflows/graph/triggers";
import { setSharedBots } from "../workflows/store/bot-access";
import { importDocument } from "../workflows/store/import";
import { pauseWorkflow, publishWorkflow } from "../workflows/store/publish";
import { getRun, listRuns } from "../workflows/store/runs";
import { getWorkflow, saveDraft } from "../workflows/store/workflows";
import { BLOCK_GUIDE, guideOf } from "./block-guide";
import { describeFields, pathsOf } from "./fields";
import { referenceProblems, runReport } from "./report";
import { blocksRun, dataChanges } from "./test-scope";
import { buildGraph, type DraftEdge, type DraftNode, graphForModel } from "./graph-edit";
import { mergeSettings } from "./merge";
import { rankActions } from "./search";
import { liveAssistant } from "./live";
import { saveMemory } from "./store";

export type AssistantToolContext = { env: Env; db: Db; userId: string; workflowId: string; runId: string };

/** Real read-only app calls ("try_action") one slice may make to see an action's real output. */
const MAX_TRIES = 15;
/** Test runs one assistant turn may start: each one can call paid apps. */
const MAX_TEST_RUNS = 10;

/** Every block kind, as a fixed list in the tool schema: a model cannot invent "app_action" or "trigger". */
const KINDS = nodeSchema.options.map((o) => o.shape.kind.value) as [NodeKind, ...NodeKind[]];

/**
 * Settings as an object, or as JSON text: some models send "{}" as a string. A plain union (no transform), because
 * tool schemas are sent to the model as JSON Schema, which cannot express a transform. The text is read in asSettings.
 */
const settings = z.union([z.record(z.string(), z.unknown()), z.string().max(20_000)]);

type Settings = z.infer<typeof settings>;

/** The settings as an object, or undefined when none were given. Text that is not a JSON object is refused. */
function asSettings(value: Settings | undefined): Record<string, unknown> | undefined | { error: string } {
  if (value === undefined || typeof value === "object") return value;
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // Reported below.
  }
  return { error: "config must be an object of settings, e.g. {\"toolkit\":\"gmail\"}." };
}
const isError = (v: unknown): v is { error: string } => typeof v === "object" && v !== null && "error" in v && Object.keys(v).length === 1;

/** A block from the model with its settings as an object, or the reason it cannot be used. */
function toDraft(block: { config?: Settings } & Omit<DraftNode, "config">): DraftNode | string {
  const config = asSettings(block.config);
  if (isError(config)) return `Block ${block.id}: ${config.error}`;
  const { config: _raw, ...rest } = block;
  return { ...rest, ...(config ? { config } : {}) };
}

const blockFields = {
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).describe("A short unique id, e.g. gmail_fetch"),
  kind: z.enum(KINDS),
  label: z.string().max(80).optional(),
  config: settings.optional().describe("The block settings, as in the workflow rules"),
  retry: z.record(z.string(), z.unknown()).optional(),
  onError: z.enum(["stop", "continue"]).optional(),
};
const nodeField = z.object(blockFields);
const edgeField = z.object({
  source: z.string().max(40),
  target: z.string().max(40),
  branch: z.string().max(40).optional(),
});

/**
 * The assistant's tools. It acts as the user, on the one workflow the chat is about, through the same store and
 * validation the builder uses. Every draft change is pushed to the open builder, so the canvas updates as it works.
 * Turning on and sharing with bots always ask the user first (a card in the chat).
 */
export function createAssistantTools(ctx: AssistantToolContext) {
  const { env, db, userId, workflowId } = ctx;
  const live = liveAssistant(env, workflowId);
  let testRuns = 0;

  /** Real outputs seen so far, by block id: pinned samples and the steps of runs read in this turn. */
  const samples: Record<string, unknown> = {};
  const nameOfBlock = (g: { nodes: Array<{ id: string; label?: string }> }) => (id: string) => g.nodes.find((n) => n.id === id)?.label ?? id;
  const configOfBlock = (g: { nodes: Array<{ id: string; config?: unknown }> }) => (id: string) => g.nodes.find((n) => n.id === id)?.config;
  /** A run as the report the assistant reads (failure, every step's input and output); also remembers its outputs. */
  const reportOf = (run: Parameters<typeof runReport>[0], g: Parameters<typeof nameOfBlock>[0] & Parameters<typeof configOfBlock>[0]) => {
    for (const st of run.steps) if (st.status === "succeeded" && st.output !== undefined) samples[st.nodeId] = st.output;
    return asText(runReport(run, { nameOf: nameOfBlock(g), configOf: configOfBlock(g) }), 16_000);
  };

  const load = async () => {
    const w = await getWorkflow(db, userId, workflowId);
    if (!w) throw new Error("The workflow no longer exists.");
    return w;
  };

  /** Applies a change to the draft: validates, saves, and shows it on the canvas. Returns text for the model. */
  async function edit(change: (g: { nodes: DraftNode[]; edges: DraftEdge[] }) => { nodes: DraftNode[]; edges: DraftEdge[] } | string) {
    const w = await load();
    const next = change(graphForModel(w.graph));
    if (typeof next === "string") return next;
    const built = buildGraph(w.graph, next.nodes, next.edges);
    if ("error" in built) return `Not saved, the workflow would not be valid: ${built.error}`;
    const saved = await saveDraft(db, userId, workflowId, { graph: built.graph }, w.updatedAt.toISOString());
    if (!saved) return "Not saved: the workflow changed meanwhile. Call get_workflow and try again.";
    await live.draftUpdated();
    const issues = describeWorkflow(saved).issues;
    // {{references}} to a field the earlier block did not really return (checked against pinned samples and runs seen).
    const known = { ...saved.graph.pins, ...samples };
    const wrongReferences = saved.graph.nodes.flatMap((n) => referenceProblems(n.config, known).map((p) => ({ block: n.id, ...p })));
    return JSON.stringify({
      saved: true,
      issues,
      ...(wrongReferences.length ? { wrongReferences, fix: "These references point at fields the block never returned. Use one of realFields, then update the block." } : {}),
    });
  }

  const getWorkflowTool = tool(
    async () => {
      const w = await load();
      const last = (await listRuns(db, userId, workflowId, 1))[0];
      const run = last ? await getRun(db, userId, last.id) : null;
      const lastRun = run ? runReport(run, { nameOf: nameOfBlock(w.graph), configOf: configOfBlock(w.graph) }) : null;
      // Only the verdict here (which block failed and why); get_run_report has every step's input and output.
      return asText(
        { ...describeWorkflow(w, true), lastRun: lastRun ? { runId: lastRun.runId, status: lastRun.status, failedAt: lastRun.failedAt, error: lastRun.error } : null },
        14_000,
      );
    },
    {
      name: "get_workflow",
      description:
        "The workflow being edited: name, status, every block and connection, what still blocks turning it on, and how its last run went (a failed run says which block and why, also a run the user started).",
      schema: z.object({}),
    },
  );

  const setWorkflow = tool(
    async ({ nodes, edges }) =>
      edit(() => {
        const drafts = nodes.map(toDraft);
        const bad = drafts.find((d) => typeof d === "string");
        return typeof bad === "string" ? bad : { nodes: drafts as DraftNode[], edges };
      }),
    {
    name: "set_workflow",
    description:
      "Replace ALL blocks and connections at once. Prefer add_block / update_block for small changes: the user watches the canvas change step by step.",
    schema: z.object({ nodes: z.array(nodeField).min(1).max(50), edges: z.array(edgeField).max(100) }),
  });

  const addBlock = tool(
    async ({ after, branch, ...input }) =>
      edit((g) => {
        const block = toDraft(input);
        if (typeof block === "string") return block;
        if (g.nodes.some((n) => n.id === block.id)) return `A block with id ${block.id} already exists.`;
        if (after && !g.nodes.some((n) => n.id === after)) return `There is no block ${after}.`;
        return {
          nodes: [...g.nodes, block],
          edges: after ? [...g.edges, { source: after, target: block.id, ...(branch ? { branch } : {}) }] : g.edges,
        };
      }),
    {
      name: "add_block",
      description:
        "Add one block, connected after the block `after` (on output `branch` of an If/Switch/For each block). Example: {id:\"gmail_fetch\", kind:\"action.app\", config:{toolkit:\"gmail\", tool:\"GMAIL_FETCH_EMAILS\", version:\"…\", arguments:{max_results:10}}, after:\"trigger\"}.",
      schema: z.object({ ...blockFields, after: z.string().max(40).optional(), branch: z.string().max(40).optional() }),
    },
  );

  const updateBlock = tool(
    async ({ id, label, config, retry, onError }) =>
      edit((g) => {
        const found = g.nodes.find((n) => n.id === id);
        if (!found) return `There is no block ${id}.`;
        const patch = asSettings(config);
        if (isError(patch)) return `Block ${id}: ${patch.error}`;
        const updated: DraftNode = {
          ...found,
          ...(label !== undefined ? { label } : {}),
          ...(patch ? { config: mergeSettings(found.config, patch) } : {}),
          ...(retry ? { retry } : {}),
          ...(onError ? { onError } : {}),
        };
        return { nodes: g.nodes.map((n) => (n.id === id ? updated : n)), edges: g.edges };
      }),
    {
      name: "update_block",
      description: "Change one block's settings. `config` is merged into its current settings, also inside nested objects (changing one of an action's `arguments` keeps the others).",
      schema: z.object({
        id: z.string().max(40),
        label: z.string().max(80).optional(),
        config: settings.optional(),
        retry: z.record(z.string(), z.unknown()).optional(),
        onError: z.enum(["stop", "continue"]).optional(),
      }),
    },
  );

  const removeBlock = tool(
    async ({ id }) =>
      edit((g) =>
        g.nodes.some((n) => n.id === id)
          ? { nodes: g.nodes.filter((n) => n.id !== id), edges: g.edges.filter((e) => e.source !== id && e.target !== id) }
          : `There is no block ${id}.`,
      ),
    { name: "remove_block", description: "Remove one block and its connections.", schema: z.object({ id: z.string().max(40) }) },
  );

  const removeBlocks = tool(
    async ({ ids, all, keepTrigger }) =>
      edit((g) => {
        const gone = new Set(all ? g.nodes.filter((n) => !(keepTrigger && n.kind.startsWith("trigger."))).map((n) => n.id) : ids);
        const missing = [...gone].filter((id) => !g.nodes.some((n) => n.id === id));
        if (missing.length) return "There is no block " + missing.join(", ") + ".";
        if (gone.size === 0) return "Nothing to remove.";
        return { nodes: g.nodes.filter((n) => !gone.has(n.id)), edges: g.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)) };
      }),
    {
      name: "remove_blocks",
      description:
        "Remove several blocks at once (ids), or every block (all: true; the trigger stays unless keepTrigger is false) with their connections. Use it to start over or to clear a broken part.",
      schema: z.object({
        ids: z.array(z.string().max(40)).max(50).default([]),
        all: z.boolean().default(false),
        keepTrigger: z.boolean().default(true),
      }),
    },
  );

  const connect = tool(
    async ({ source, target, branch, remove }) =>
      edit((g) => {
        const same = (e: DraftEdge) => e.source === source && e.target === target && (e.branch ?? "") === (branch ?? "");
        if (remove) return { nodes: g.nodes, edges: g.edges.filter((e) => !same(e)) };
        if (g.edges.some(same)) return "They are already connected.";
        return { nodes: g.nodes, edges: [...g.edges, { source, target, ...(branch ? { branch } : {}) }] };
      }),
    {
      name: "connect_blocks",
      description: "Connect two blocks (or remove that connection with remove: true). `branch`: the If/Switch/For each output.",
      schema: z.object({ source: z.string().max(40), target: z.string().max(40), branch: z.string().max(40).optional(), remove: z.boolean().optional() }),
    },
  );

  const rename = tool(
    async ({ name, description }) => {
      const saved = await saveDraft(db, userId, workflowId, { name, ...(description !== undefined ? { description } : {}) });
      if (saved) await live.draftUpdated();
      return saved ? "Renamed." : "The workflow no longer exists.";
    },
    { name: "rename_workflow", description: "Set the workflow's name and description.", schema: z.object({ name: z.string().trim().min(1).max(80), description: z.string().max(500).optional() }) },
  );

  const findApps = tool(
    async ({ query }) => {
      const { items } = await searchCatalog(db, { q: query, offset: 0, limit: 10 });
      return JSON.stringify(items.map((a) => ({ app: a.slug, name: a.name, actions: a.toolsCount, events: a.triggersCount, noLogin: a.noAuth })));
    },
    { name: "find_apps", description: "Search the app catalog (Gmail, Slack, Sheets…). Returns app slugs for the other tools.", schema: z.object({ query: z.string().max(80) }) },
  );

  const findActions = tool(
    async ({ app, query }) => {
      const all = await listTools(composioFor(env), app);
      const matches = rankActions(all, query);
      // Nothing matched: list the app's first actions, so the model picks from real ones instead of searching again.
      const shown = matches.length ? matches : all.slice(0, 25);
      return JSON.stringify({
        ...(matches.length ? {} : { note: `No action matched "${query}". These are ${app}'s first actions:` }),
        actions: shown.map(({ slug, name, description, version }) => ({ action: slug, name, description: description.slice(0, 160), version })),
      });
    },
    {
      name: "find_app_actions",
      description:
        "Search an app's actions by keywords (e.g. \"fetch emails\"). Use the returned action slug and version in an action.app block (never invent slugs).",
      schema: z.object({ app: z.string().regex(TOOLKIT_SLUG), query: z.string().max(200) }),
    },
  );

  type FieldSchema = Parameters<typeof describeFields>[0];

  const actionDetails = tool(
    async ({ action }) => {
      const t = await getTool(composioFor(env), action);
      // The output schema is wrapped as { data, error, successful }; a run stores only what is inside data.
      const out = t.output as { properties?: Record<string, unknown> };
      const outData = (out.properties?.data ?? out) as FieldSchema;
      return asText(
        {
          action: t.slug,
          app: t.toolkit,
          version: t.version,
          what: t.description,
          kind: t.toolkit && isRead(t.slug, t.toolkit, t.tags) ? "reads data (safe to try)" : "changes data (do not test it unless asked)",
          // Every input with its type, whether it is required, and the app's own helper text. Fill the required ones.
          inputs: describeFields(t.input as FieldSchema),
          // What a later block can read from it (fields the app describes; try_action shows the real ones).
          outputs: describeFields(outData).map(({ name, type, help }) => ({ name, type, help: help.slice(0, 100) })),
        },
        9000,
      );
    },
    {
      name: "get_action_details",
      description:
        "Read ALL inputs of an app action before using it: each input's name, type, whether it is required, the app's helper text, choices, default and example. Also what it returns and whether it reads or changes data.",
      schema: z.object({ action: z.string().regex(/^[A-Z0-9_]{1,120}$/) }),
    },
  );

  const eventDetails = tool(
    async ({ trigger }) => {
      const t = await getTriggerType(composioFor(env), trigger);
      return asText(
        {
          trigger: t.slug,
          name: t.name,
          what: t.description,
          delivery: t.delivery === "webhook" ? "pushed at once" : "checked every few minutes",
          // The event's own settings (they go in the trigger.app block's config).
          config: describeFields(t.config as FieldSchema),
          // What the event carries: later blocks read it as {{trigger.data.<name>}}.
          payload: describeFields(t.payload as FieldSchema).map(({ name, type, help }) => ({ name, type, help: help.slice(0, 100) })),
        },
        8000,
      );
    },
    {
      name: "get_event_details",
      description: "Read an app event (a trigger): its settings with helper text, and the fields it hands the workflow. Use the slug from find_app_events.",
      schema: z.object({ trigger: z.string().regex(/^[A-Z0-9_]{1,120}$/) }),
    },
  );

  // Composio's own search (COMPOSIO_SEARCH_TOOLS): describe the work in plain words and get the matching actions across
  // every app, with the apps involved and whether the user has them connected.
  const findTools = tool(
    async ({ needs }) => {
      try {
        const session = await userSession(db, composioFor(env), userId);
        const res = (await session.executeMeta("COMPOSIO_SEARCH_TOOLS", {
          queries: needs.map((use_case) => ({ use_case })),
          session: { generate_id: true },
        })) as { data?: Record<string, any>; error?: string | null };
        const d = res.data;
        if (!d?.results) return "The tool search failed: " + (res.error ?? "no results") + ". Use find_apps and find_app_actions instead.";
        const schemas: Record<string, { toolkit?: string; description?: string }> = d.tool_schemas ?? {};
        const brief = (slug: string) => ({
          action: slug,
          app: schemas[slug]?.toolkit?.toLowerCase(),
          what: (schemas[slug]?.description ?? "").replace(/\s+/g, " ").slice(0, 150),
        });
        return asText(
          {
            results: d.results.map((r: any) => ({
              need: r.use_case,
              best: (r.primary_tool_slugs ?? []).map(brief),
              alsoRelated: (r.related_tool_slugs ?? []).slice(0, 6).map(brief),
              ...(r.recommended_plan_steps ? { suggestedSteps: r.recommended_plan_steps.slice(0, 6) } : {}),
              ...(r.known_pitfalls ? { pitfalls: r.known_pitfalls.slice(0, 4) } : {}),
            })),
            apps: (d.toolkit_connection_statuses ?? []).map((c: any) => ({ app: c.toolkit, connected: Boolean(c.has_active_connection) })),
            next: "Call get_action_details for each action you will use, to read all its inputs. Never invent a slug.",
          },
          9000,
        );
      } catch (error) {
        return "The tool search failed: " + (error as Error).message.slice(0, 160) + ". Use find_apps and find_app_actions instead.";
      }
    },
    {
      name: "find_tools",
      description:
        "START HERE for the work to automate. Describe each thing the workflow must do in plain words (up to 5, e.g. 'fetch my latest gmail emails', 'post a message to a slack channel') and get the best matching app actions across ALL apps, related ones, the apps involved and whether they are connected (Composio's COMPOSIO_SEARCH_TOOLS).",
      schema: z.object({ needs: z.array(z.string().min(3).max(300)).min(1).max(5) }),
    },
  );

  // The builder's own blocks: what each does, every setting with its helper text, an example, how to read its output.
  const blockKinds = tool(async () => JSON.stringify(BLOCK_GUIDE.map((b) => ({ kind: b.kind, title: b.title, group: b.group, use: b.use }))), {
    name: "list_block_kinds",
    description: "Every block the builder has (triggers, actions, AI, logic) and when to use it. Then read one with get_block_guide.",
    schema: z.object({}),
  });

  const blockGuide = tool(
    async ({ kind }) => {
      const g = guideOf(kind);
      return g ? asText(g, 9000) : "There is no block " + kind + ". Use list_block_kinds.";
    },
    {
      name: "get_block_guide",
      description:
        "Read one block fully: every setting with its helper text and an example, a complete example config to copy, how later blocks read its output, its connections and its rules. Read it before you add a block you have not used.",
      schema: z.object({ kind: z.enum(KINDS) }),
    },
  );

  /** Stores a sample output for a block (a pin): the builder's data picker then lists its fields, and tests reuse it. */
  async function savePin(blockId: string, output: unknown | undefined) {
    const w = await load();
    if (!w.graph.nodes.some((n) => n.id === blockId)) return "There is no block " + blockId + ".";
    const { [blockId]: _old, ...rest } = w.graph.pins ?? {};
    const pins = output === undefined ? rest : { ...rest, [blockId]: output };
    const parsed = graphSchema.safeParse({ ...w.graph, pins });
    if (!parsed.success) return "That sample is too large to keep (256 KB for all samples).";
    const saved = await saveDraft(db, userId, workflowId, { graph: parsed.data }, w.updatedAt.toISOString());
    if (!saved) return "The workflow changed meanwhile. Call get_workflow and try again.";
    await live.draftUpdated();
    if (output === undefined) delete samples[blockId];
    else samples[blockId] = output;
    return null;
  }
  let tries = 0;
  /** Whether each app action of the workflow only reads (Composio's hints, else its name), by action slug. */
  const readability = new Map<string, boolean>();
  async function learnReadability() {
    const g = (await load()).graph;
    const used = g.nodes.flatMap((n) => (n.kind === "action.app" && n.config.tool && n.config.toolkit ? [{ slug: n.config.tool, toolkit: n.config.toolkit }] : []));
    await Promise.all(
      used.map(async ({ slug, toolkit }) => {
        try {
          const d = await getTool(composioFor(env), slug);
          readability.set(slug, isRead(slug, toolkit, d.tags));
        } catch {
          // Unknown: treated as a change (being wrong only costs one question).
        }
      }),
    );
  }
  const asJson = (v: unknown): unknown => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return undefined;
    }
  };

  // "If unsure what a step gives, run the previous one": a real read-only call, as the user, to see the real output.
  const tryAction = tool(
    async ({ action, arguments: args, pinTo }) => {
      if (++tries > MAX_TRIES) return "You already made " + MAX_TRIES + " sample calls. Work with what you have.";
      const t = await getTool(composioFor(env), action);
      if (!t.toolkit) return "That action has no app.";
      if (!isRead(t.slug, t.toolkit, t.tags)) {
        return action + " changes data, so I will not run it for a sample. Read its outputs with get_action_details, or test the whole workflow when the user agrees.";
      }
      const given = (asJson(args) ?? {}) as Record<string, unknown>;
      const r = await executeAction(env, { userId, toolkit: t.toolkit, slug: t.slug, version: t.version ?? undefined, arguments: given, maxChars: 60_000 });
      if (!r.ok) {
        return asText({ ok: false, error: r.error, hint: r.fatal ? "Fix the inputs (see get_action_details), then try once more." : "A temporary problem: try again." }, 3000);
      }
      const truncated = typeof r.data === "object" && r.data !== null && "truncated" in r.data;
      let pinned: string | null = null;
      if (pinTo && !truncated) pinned = (await savePin(pinTo, r.data)) ?? "kept as the sample of block " + pinTo;
      return asText({ ok: true, fields: pathsOf(r.data), sample: JSON.stringify(r.data).slice(0, 3500), ...(pinned ? { pinned } : {}) }, 9000);
    },
    {
      name: "try_action",
      description:
        "Run a READ-ONLY app action once, as the user, to see its real output fields (for example fetch emails before you use their fields in the next block). Refuses actions that send, post, create or delete. Give pinTo (a block id) to keep the output as that block's sample so its fields show in the builder.",
      schema: z.object({
        action: z.string().regex(/^[A-Z0-9_]{1,120}$/),
        arguments: settings.optional(),
        pinTo: z.string().max(40).optional(),
      }),
    },
  );

  const pin = tool(
    async ({ blockId, output }) => {
      const value = asJson(output);
      if (output !== undefined && value === undefined) return "output must be JSON.";
      return (await savePin(blockId, value)) ?? (value === undefined ? "Sample removed." : "Sample kept.");
    },
    {
      name: "pin_output",
      description: "Keep a sample output for a block (its fields then show in the builder and test runs use it instead of calling the app). Omit output to remove the sample.",
      schema: z.object({ blockId: z.string().max(40), output: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown()), z.string().max(60_000)]).optional() }),
    },
  );

  const runDetails = tool(
    async ({ runId }) => {
      const id = runId ?? (await listRuns(db, userId, workflowId, 1))[0]?.id;
      if (!id) return "There are no runs of this workflow yet.";
      const run = await getRun(db, userId, id);
      if (!run) return "That run does not exist.";
      return reportOf(run, (await load()).graph);
    },
    {
      name: "get_run_report",
      description:
        "The full report of a run: if it failed, WHICH block and WHY (its error, what it was given, and any {{reference}} that points at a field the earlier block never returned, with the fields that do exist); then EVERY step's input and output. Defaults to the latest run, also one the user started.",
      schema: z.object({ runId: z.uuid().optional() }),
    },
  );

  const findEvents = tool(
    async ({ app }) => {
      const events = await listTriggerTypes(composioFor(env), app);
      return asText(events.slice(0, 30).map((e) => ({ trigger: e.slug, name: e.name, description: e.description })), 6000);
    },
    { name: "find_app_events", description: "The events of an app that can start a workflow (for a trigger.app block).", schema: z.object({ app: z.string().regex(TOOLKIT_SLUG) }) },
  );

  const connectApps = tool(
    async () => {
      const apps = await missingApps(env, db, userId, toolkitsOf((await load()).graph));
      if (apps.length === 0) return "Every app this workflow uses is connected.";
      interrupt({ kind: "connect_apps", question: `Connect ${apps.map((a) => a.name).join(", ")} to continue.`, apps });
      const still = await missingApps(env, db, userId, toolkitsOf((await load()).graph));
      return still.length ? `Still not connected: ${still.map((a) => a.name).join(", ")}. Tell the user it cannot run without them.` : "All apps are connected now.";
    },
    {
      name: "request_app_connections",
      description: "Check which apps of this workflow the user has not connected; if any, show Connect buttons and wait.",
      schema: z.object({}),
    },
  );

  const test = tool(
    async ({ until, inputs }) => {
      if (++testRuns > MAX_TEST_RUNS) return `You already started ${MAX_TEST_RUNS} test runs this turn. Report what you found.`;
      await learnReadability();
      const w = await load();
      // The same trigger data the Run button builds: a manual form, a webhook body, a sample app event…
      const form = triggerInput(triggerOf(w.graph), inputs ?? {});
      if ("problems" in form) return `Not started: ${form.problems.join(" ")}`;

      // A test runs the real steps. If it would change data in the user's apps (append a row, send a message, a POST),
      // the user is asked first, in the chat: the test is never silently skipped, and never run without their yes.
      const changes = dataChanges(blocksRun(w.graph, until), (toolkit, tool) => readability.get(tool) ?? isRead(tool, toolkit));
      if (changes.length > 0) {
        const answer = interrupt({
          kind: "confirm",
          action: "test",
          question: "This test really runs: " + changes.join("; ") + ". It will change data in your apps. Run the test?",
        }) as { approved?: boolean };
        if (!answer?.approved) {
          return "The user did not allow a test that changes data, so nothing ran. The build is done but UNTESTED: say so in your final answer, and name the steps that would change data (" + changes.join("; ") + ").";
        }
      }
      try {
        const run = await startRun(env, db, {
          workflowId,
          userId,
          trigger: "test",
          graph: { ...w.graph, ...(until ? { stopAfter: until } : {}) },
          input: form,
        });
        const waited = await waitForRun(db, userId, run.id);
        // A finished run comes back as a report: where it failed and why, and each step's output.
        const finished = await getRun(db, userId, run.id);
        if (finished && ["succeeded", "failed", "cancelled"].includes(finished.status)) {
          return reportOf(finished, w.graph);
        }
        return waited;
      } catch (error) {
        if (error instanceof RunStartError) return `Not started: ${error.message}`;
        throw error;
      }
    },
    {
      name: "test_workflow",
      description:
        "Start a test run of the draft (the user sees it live on the canvas) and wait up to 45 s. `until`: only that block and the ones before it (Test this step). Calls real apps. If the test would change data (append a row, send a message, a POST), the user is asked first in the chat: call it anyway for the full workflow, never skip it yourself.",
      schema: z.object({ until: z.string().max(40).optional(), inputs: z.record(z.string().max(100), z.unknown()).optional() }),
    },
  );

  const turnOn = tool(
    async () => {
      const w = await load();
      const answer = interrupt({ kind: "confirm", action: "turn_on", question: `Turn on “${w.name}”? It will start running on its trigger.` }) as { approved?: boolean };
      if (!answer?.approved) return "The user said no. It stays off.";
      const r = await publishWorkflow(env, db, userId, await load());
      if (!r.ok) return `Cannot turn it on: ${r.message}`;
      await live.draftUpdated();
      // The webhook token is shown to the user only, in the builder.
      return "It is on.";
    },
    { name: "turn_on_workflow", description: "Turn the workflow on (asks the user to confirm). Only when the user asked for it.", schema: z.object({}) },
  );

  const turnOff = tool(
    async () => {
      const row = await pauseWorkflow(env, db, userId, await load());
      if (row) await live.draftUpdated();
      return row ? "It is off." : "The workflow no longer exists.";
    },
    { name: "turn_off_workflow", description: "Turn the workflow off (its trigger stops starting runs).", schema: z.object({}) },
  );

  const listBots = tool(
    async () => JSON.stringify(await db.select({ id: bot.id, name: bot.name, role: bot.role }).from(bot).where(eq(bot.userId, userId))),
    { name: "list_bots", description: "The user's bots (ids for share_with_bots and Ask a bot blocks).", schema: z.object({}) },
  );

  const share = tool(
    async ({ botIds }) => {
      const answer = interrupt({ kind: "confirm", action: "share", question: `Let ${botIds.length} bot(s) see and run this workflow?`, botIds }) as { approved?: boolean };
      if (!answer?.approved) return "The user said no.";
      const shared = await setSharedBots(db, userId, workflowId, botIds);
      return `Shared with ${shared.length} bot(s).`;
    },
    {
      name: "share_with_bots",
      description: "Choose which of the user's bots may see and run this workflow (replaces the list; asks the user first).",
      schema: z.object({ botIds: z.array(z.string().min(1).max(64)).max(20) }),
    },
  );

  const exportJson = tool(async () => asText(toPortable(await load()), 12_000), {
    name: "export_workflow_json",
    description: "The workflow as a shareable k4-workflow JSON document (accounts, bots and secrets left out).",
    schema: z.object({}),
  });

  const importJson = tool(
    async ({ document }) => {
      const w = await load();
      let doc: unknown = document;
      if (typeof doc === "string") {
        doc = asJson(doc);
        if (doc === undefined) return "Not imported: that is not valid JSON.";
      }
      // A bare graph ({nodes, edges}) is accepted too: it is wrapped as a k4-workflow file for this workflow.
      const obj = doc as { format?: unknown; nodes?: unknown; edges?: unknown };
      if (obj && typeof obj === "object" && !obj.format && Array.isArray(obj.nodes)) {
        doc = { format: "k4-workflow", version: 1, name: w.name, description: w.description, graph: { nodes: obj.nodes, edges: obj.edges ?? [] } };
      }
      const r = await importDocument(db, userId, workflowId, doc, w.updatedAt.toISOString());
      if (!r.ok) return "Not imported: " + r.message + (r.issues ? " " + r.issues.slice(0, 3).map((i) => i.message).join(" ") : "");
      // Every open builder reloads the new draft at once (the same event as any other edit).
      await live.draftUpdated();
      return "Imported " + r.row.graph.nodes.length + " blocks. Accounts, bots and secrets must be chosen again.";
    },
    {
      name: "import_workflow_json",
      description:
        "Replace the whole draft with JSON: a k4-workflow document, or just {nodes, edges} (each node needs id, kind, position {x,y} and config; see get_block_guide for configs). The open builder updates at once.",
      schema: z.object({ document: z.union([z.record(z.string(), z.unknown()), z.string().max(500_000)]) }),
    },
  );

  const remember = tool(
    async ({ content }) => {
      await saveMemory(db, userId, content);
      return "Saved.";
    },
    {
      name: "save_memory",
      description:
        "Replace what you remember about this user across workflows (stable preferences only, e.g. 'posts alerts to Slack #ops'). Never secrets, tokens or data from runs. Keep what is still true.",
      schema: z.object({ content: z.string().max(8000) }),
    },
  );

  return [
    getWorkflowTool,
    blockKinds,
    blockGuide,
    findTools,
    setWorkflow,
    addBlock,
    updateBlock,
    removeBlock,
    removeBlocks,
    connect,
    rename,
    findApps,
    findActions,
    actionDetails,
    findEvents,
    eventDetails,
    tryAction,
    pin,
    runDetails,
    connectApps,
    test,
    turnOn,
    turnOff,
    listBots,
    share,
    exportJson,
    importJson,
    remember,
  ];
}
