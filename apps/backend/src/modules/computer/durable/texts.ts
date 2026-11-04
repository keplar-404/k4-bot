import type { Closed } from "./constants";

/** What a bot is told once the computer was shut down while it worked. */
export function closedText(cause: Closed["cause"]): string {
  switch (cause) {
    case "user":
      return (
        "The user shut the computer down while you were working. It is OFF now and you must NOT ask to turn it on. " +
        "Stop working. Reply with a short final message: say the computer was closed by the user, what you had finished, and that you could not complete the rest."
      );
    case "quota":
      return (
        "The computer shut down because today's computer time ran out. It cannot be turned on again by anyone until 00:00 UTC. Do NOT ask to turn it on. " +
        "Stop working. Reply with a short final message: what you finished, and that you could not complete the rest because the daily computer time ended."
      );
    case "reset":
      return (
        "The user reset the computer while you were working: it was wiped to a brand-new machine and your files on it are gone. " +
        "Stop working and do NOT ask to turn it on. Reply with a short final message: say the computer was reset by the user, what you had finished, and that you could not complete the rest."
      );
    case "session":
      return (
        "The computer went to sleep while you were working (its session or the wrap-up time ended). " +
        "Stop working. Reply with a short final message: what you finished and what is left. The user can wake the computer and ask you to continue."
      );
  }
}

export const STARTING_TEXT = "The computer is starting. Wait a few seconds, then try again.";

export const USED_UP_TEXT =
  "Today's computer time is used up. Nobody can turn the computer on until 00:00 UTC, so do NOT call turn_on_computer. Tell the user what you could not do.";

/** The computer is simply off: the bot may ask to turn it on. */
export const offText = (message?: string) =>
  `The computer is off${message ? ` (${message.replace(/\.$/, "")})` : ""}. ` +
  "To use it, call turn_on_computer now: that asks the user with an Approve / Reject button, so do not ask them in text.";

export const wrapUpNotice = (seconds: number) =>
  `The user asked you to wrap up: the computer goes to sleep in at most ${seconds}s (its state is saved), sooner once every bot is done. ` +
  "Start no new computer work. Finish the step you are on, save anything important to files, then reply with a short summary of what you did and what is left.";

export const quotaNotice = (seconds: number) =>
  `Today's computer time ends in about ${seconds}s. Then the computer shuts down and cannot be turned on again until 00:00 UTC. ` +
  "Start no new computer work. Save anything important to files, then reply with a short summary of what you did and what is left.";
