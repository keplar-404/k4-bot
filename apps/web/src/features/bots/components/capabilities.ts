/** A bot's capability settings, as the bot form edits them. */
export interface Capabilities {
  subagentsEnabled: boolean;
  maxSubagents: number;
  maxParallelTools: number;
}

export const one = (v: number | readonly number[]) =>
  (Array.isArray(v) ? v[0] : v) as number;
