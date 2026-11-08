import { createMiddleware } from "langchain";
import type { GroupHub } from "../tools/subagents/hub";

/**
 * Removes tools the harness adds on its own from what the model is offered. Used for Deep Agents' built-in `task`
 * (a general-purpose sub-agent every deep agent gets): sub-agents are a capability a bot is given on purpose
 * (spawn_subagents), never a side door.
 *
 * LangChain refuses two middlewares with the same name in one agent, so each use names itself.
 */
export function createHideToolsMiddleware(names: string[], name = "HideToolsMiddleware") {
  const hidden = new Set(names);
  return createMiddleware({
    name,
    wrapModelCall: (request, handler) =>
      handler({ ...request, tools: request.tools.filter((t) => !hidden.has(String((t as { name?: string }).name))) }),
  });
}

/** Hides `names` only while a sub-agent group of this run is still working. */
export function createGroupGuardMiddleware(hub: GroupHub, names: string[]) {
  const hidden = new Set(names);
  return createMiddleware({
    name: "GroupGuardMiddleware",
    wrapModelCall: (request, handler) =>
      hub.running ? handler({ ...request, tools: request.tools.filter((t) => !hidden.has(String((t as { name?: string }).name))) }) : handler(request),
  });
}
