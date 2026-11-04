/** Approval prompts in the user's words; the tool name is the fallback. */
export const APPROVAL_LABEL: Record<string, string> = {
  turn_on_computer: "Turn on your computer",
  turn_off_computer: "Turn off your computer (its work is saved)",
};

type Action = { name: string; args: Record<string, unknown> };
const text = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : "?";

/**
 * What the user is asked to approve. A sandbox deletion names whose sandbox, what it was for and when it was last
 * used (the tool checks these match the real sandbox before it deletes anything), so the user knows what they lose.
 */
export function approvalLabel(a: Action): string {
  if (a.name === "sandbox_delete") {
    return `Delete the sandbox of "${text(a.args.bot_name)}" (for "${text(a.args.purpose)}", last used ${text(a.args.last_used)}) and all its files`;
  }
  return (
    APPROVAL_LABEL[a.name] ??
    `Approve ${a.name}${a.args.file_path ? ` ${String(a.args.file_path)}` : ""}`
  );
}
