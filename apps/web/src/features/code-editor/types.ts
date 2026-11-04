/** A file open in the editor: its path, the version on the sandbox (`saved`, `hash`) and the user's draft (`text`). */
export type Doc = { path: string; saved: string; text: string; hash: string };

/** One command the bot ran in the sandbox, as the terminal pane shows it. */
export type TerminalLine = {
  command: string;
  exitCode: number;
  output: string;
  at: number;
};
