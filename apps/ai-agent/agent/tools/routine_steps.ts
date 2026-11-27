// Routines plug-in: saves how the job succeeded, so the next run doesn't work it out
// again. Only in routine runs. The user sees and can edit it in Edit routine.
import { notesTool } from "../lib/routine-notes";

export default notesTool(
	"steps",
	"Save the numbered steps that made this routine succeed (tool names, key inputs, order). Replaces the saved steps. Short; no secrets or personal data.",
);
