import { useEffect } from "react";
import { toast } from "sonner";

const names = (list: { name: string }[]) =>
  list.length <= 2
    ? list.map((b) => b.name).join(" and ")
    : `${list[0]?.name}, ${list[1]?.name} and ${list.length - 2} more`;

/** What the end-of-session card says: the countdown and what happens next. */
export function wrapUpText(o: {
  wrapping: boolean;
  quota: boolean;
  clock: string;
  working: { name: string }[];
}) {
  return {
    title: o.wrapping
      ? `Wrapping up. The computer sleeps in at most ${o.clock}.`
      : o.quota
        ? `Today's computer time ends in ${o.clock}.`
        : `The computer session ends in ${o.clock}.`,
    description: o.wrapping
      ? o.working.length > 0
        ? `Waiting for ${names(o.working)} to finish and summarise. It sleeps as soon as they are done. Everything on the computer is saved.`
        : "Everything is saved."
      : o.quota
        ? "Then the computer shuts down and nobody can turn it on again until 00:00 UTC. Your bots have been told to save their work. Wrap up now to let them finish and keep the minutes that are left."
        : "Wrap up to let your bots finish and summarise, or stop now. Everything on the computer is saved either way.",
  };
}

/** One toast per quota warning, so a user who is looking at another tab still notices. */
export function useQuotaToast(show: boolean) {
  useEffect(() => {
    if (show) {
      toast.warning("Today's computer time is almost used up", {
        id: "computer-quota",
        description:
          "Wrap up what your bots are doing: the computer shuts down when it runs out.",
      });
    }
  }, [show]);
}
