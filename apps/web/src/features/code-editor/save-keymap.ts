import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";

/** Ctrl/Cmd+S runs `save` inside the editor (before the browser's own "save page"). */
export const saveKeymap = (save: () => void) =>
  Prec.highest(
    keymap.of([
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          save();
          return true;
        },
      },
    ]),
  );
