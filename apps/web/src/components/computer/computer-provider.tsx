"use client";

import { createContext, type ReactNode, use } from "react";
import { CloseComputerDialog } from "@/components/computer/close-computer-dialog";
import { type Computer, useComputer } from "@/hooks/use-computer";

const ComputerContext = createContext<Computer | null>(null);

/** One connection to the user's computer for the whole page: the side panel and the chat both read it. */
export function ComputerProvider({ children }: { children: ReactNode }) {
  const computer = useComputer();
  return (
    <ComputerContext value={computer}>
      {children}
      <CloseComputerDialog computer={computer} />
    </ComputerContext>
  );
}

export function useComputerContext(): Computer {
  const computer = use(ComputerContext);
  if (!computer)
    throw new Error("useComputerContext must be used inside ComputerProvider");
  return computer;
}
