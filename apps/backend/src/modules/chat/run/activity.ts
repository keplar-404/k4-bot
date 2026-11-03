/** Shell and file tools as one line for the computer's Activity feed (screen actions are noted by the computer itself). */
export function describeActivity(name: string, input: string): string | null {
  let a: Record<string, unknown> = {};
  try {
    a = JSON.parse(input) as Record<string, unknown>;
  } catch {
    // clipped input: fall back to the tool name only
  }
  const path = String(a.file_path ?? a.path ?? "");
  switch (name) {
    case "execute":
      return `Ran ${String(a.command ?? "a command")}`;
    case "write_file":
      return `Wrote ${path}`;
    case "edit_file":
      return `Edited ${path}`;
    case "read_file":
      return `Read ${path}`;
    case "ls":
      return `Listed ${path}`;
    case "glob":
    case "grep":
      return `Searched files ${String(a.pattern ?? "")}`.trim();
    case "share_file":
      return `Shared ${path} with the user`;
    case "copy_to_computer":
      return `Copied a file to ${path || "its files folder"}`;
    default:
      return null;
  }
}
