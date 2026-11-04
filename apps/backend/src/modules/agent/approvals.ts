import type { InterruptOnConfig } from "langchain";

/**
 * Human-in-the-loop (Deep Agents `interruptOn`): the run pauses before these tools run and the
 * chat shows Approve / Reject. https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop
 *
 * Without a computer, file writes go to a virtual filesystem and still ask first. With one, the
 * bot's files live in its own Linux account; what needs the user is waking the shared computer (it costs
 * computer time) and shutting it down while another bot is working (that stops the other bot).
 */
export const fileApprovals: Record<string, InterruptOnConfig> = {
  write_file: { allowedDecisions: ["approve", "edit", "reject"] },
  edit_file: { allowedDecisions: ["approve", "edit", "reject"] },
};

// turn_off_computer is not listed: the tool itself asks the user, but only when another bot is working or the user
// holds the mouse (see computer/tools/power.ts). Turning off an idle computer needs no approval.
/** Deleting a sandbox destroys all its files: always asked, showing the bot, purpose and last use the tool names. */
export const sandboxApprovals: Record<string, InterruptOnConfig> = {
  sandbox_delete: { allowedDecisions: ["approve", "reject"], description: "Delete this sandbox and all its files?" },
};

export const computerApprovals: Record<string, InterruptOnConfig> = {
  turn_on_computer: { allowedDecisions: ["approve", "reject"], description: "Turn on your computer?" },
};
