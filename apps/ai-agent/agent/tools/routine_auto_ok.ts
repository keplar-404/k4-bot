// Routines plug-in: the list of things this routine does without the user's approval
// (reading, preparing data, sheets, the computer). Guidance only: sending, posting,
// merging and deleting always need the user, whatever this says (lib/routine.ts).
import { notesTool } from "../lib/routine-notes";

export default notesTool(
	"autoOk",
	"Save a short numbered list of actions this routine did that needed no user approval (reading, preparing data, updating sheets, work on the computer). Replaces the saved list.",
);
