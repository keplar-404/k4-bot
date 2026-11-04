import { request } from "./http";
import { refreshIntegrations } from "./store";
import type { SkillDetails } from "./types";

export function getSkillDetails(skillId: string) {
  return request<{ skill: SkillDetails }>(
    `/skills/details?skillId=${encodeURIComponent(skillId)}`,
  ).then((r) => r.skill);
}

export async function installSkill(skillId: string) {
  await request("/skills", {
    method: "POST",
    body: JSON.stringify({ skillId }),
  });
  await refreshIntegrations();
}

export async function uninstallSkill(id: string) {
  await request(`/skills/${id}`, { method: "DELETE" });
  await refreshIntegrations();
}

/** The token is sent once over HTTPS, checked against the app, then stored encrypted. It never comes back. */
export async function connectMcp(
  serverId: string,
  secrets?: Record<string, string>,
) {
  const result = await request<{ id: string; tools: string[] }>("/mcp", {
    method: "POST",
    body: JSON.stringify({ serverId, secrets }),
  });
  await refreshIntegrations();
  return result;
}

export async function replaceMcpSecrets(
  id: string,
  secrets: Record<string, string>,
) {
  await request(`/mcp/${id}/secrets`, {
    method: "PUT",
    body: JSON.stringify({ secrets }),
  });
  await refreshIntegrations();
}

export async function disconnectMcp(id: string) {
  await request(`/mcp/${id}`, { method: "DELETE" });
  await refreshIntegrations();
}

export type McpTestResult =
  | { ok: true; tools: string[]; ms: number }
  | { ok: false; message: string };

/** A real call to the connected app with its saved token (the server lists its tools); nothing is changed. */
export function testMcp(id: string) {
  return request<McpTestResult>(`/mcp/${id}/test`, { method: "POST" });
}
