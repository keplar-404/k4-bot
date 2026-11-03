import type { Dispatch, SetStateAction } from "react";
import {
  type ComputerStatus,
  closeComputer,
  getStatus,
  releaseControl,
  takeControl,
  type WorkingBot,
  wake,
  wrapUp,
} from "@/features/computer/api";
import type { ComputerAction } from "./use-computer";

type Blockers = { bots: WorkingBot[]; at: number } | null;

/** What the user can do with the computer. `run` shows the action as pending and reports its error. */
export function computerActions(o: {
  run: (name: ComputerAction, action: () => Promise<unknown>) => Promise<void>;
  applyStatus: (s: ComputerStatus) => void;
  setStatus: Dispatch<SetStateAction<ComputerStatus | null>>;
  setBlockers: Dispatch<SetStateAction<Blockers>>;
  setError: Dispatch<SetStateAction<string | null>>;
}) {
  const { run, applyStatus, setStatus, setBlockers, setError } = o;
  return {
    wake: () =>
      run("wake", async () => {
        // Show "starting" at once; the server's own status replaces it within moments.
        setStatus((s) =>
          s ? { ...s, state: "starting", message: "Waking your computer…" } : s,
        );
        try {
          applyStatus(await wake());
        } catch (e) {
          // Do not leave the optimistic "starting" behind.
          void getStatus()
            .then(applyStatus)
            .catch(() => undefined);
          throw e;
        }
      }),
    /** Sleeps the computer. If bots are using it, nothing happens yet and `blockers` asks the user what to do. */
    pause: (force = false) =>
      run("pause", async () => {
        const result = await closeComputer(force);
        if (result.closed) {
          setBlockers(null);
          applyStatus(result.status);
        } else setBlockers({ bots: result.working, at: Date.now() });
      }),
    wrapUp: () =>
      run("wrap", async () => {
        setBlockers(null);
        applyStatus(await wrapUp());
      }),
    takeControl: () =>
      run("take", async () => {
        const result = await takeControl();
        if (!result.ok) setError(result.message ?? "Could not take control.");
      }),
    releaseControl: () => run("release", releaseControl),
  };
}
