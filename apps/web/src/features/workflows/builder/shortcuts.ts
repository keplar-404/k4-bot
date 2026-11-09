/** The builder's shortcuts, as the dialog lists them. "Mod" is ⌘ on a Mac, Ctrl elsewhere. */
export const SHORTCUTS: Array<{
  group: string;
  items: Array<{ keys: string[]; what: string }>;
}> = [
  {
    group: "Panels",
    items: [
      { keys: ["Mod", "K"], what: "Show these shortcuts" },
      { keys: ["["], what: "Show or hide the blocks" },
      { keys: ["]"], what: "Show or hide the settings" },
      { keys: ["Esc"], what: "Deselect the block" },
    ],
  },
  {
    group: "Canvas",
    items: [
      { keys: ["F"], what: "Fit the workflow on screen" },
      { keys: ["+"], what: "Zoom in" },
      { keys: ["-"], what: "Zoom out" },
      { keys: ["Delete"], what: "Delete the selected block or connection" },
      { keys: ["Shift", "Drag"], what: "Select several blocks" },
    ],
  },
  {
    group: "Connecting",
    items: [
      { keys: ["Drag a dot"], what: "Connect to another block" },
      { keys: ["Click"], what: "Add a block from the library (or drag it in)" },
    ],
  },
];

export const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);
