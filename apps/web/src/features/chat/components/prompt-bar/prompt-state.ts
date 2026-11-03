import type { createShader } from "glimm";
import { useRef, useState } from "react";
import { RAINBOW } from "./data";

/** A measured menu row: where to draw the hover highlight. */
type Box = { top: number; height: number };
export function usePromptState() {
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [effortBox, setEffortBox] = useState<Box | null>(null);
  const [effortHovered, setEffortHovered] = useState<number | null>(null);
  const [effortMenuLeft, setEffortMenuLeft] = useState(0);
  const [effortMenuBottom, setEffortMenuBottom] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const wide = expanded;
  const [rowBox, setRowBox] = useState<Box | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [modelBox, setModelBox] = useState<Box | null>(null);
  const [modelHovered, setModelHovered] = useState<number | null>(null);
  const [modelMenuLeft, setModelMenuLeft] = useState(0);
  const [modelMenuBottom, setModelMenuBottom] = useState(0);
  const composerAnchorRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modelRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const effortRef = useRef<HTMLButtonElement>(null);
  const effortRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const glimmRef = useRef<HTMLCanvasElement>(null);
  const shaderRef = useRef<ReturnType<typeof createShader> | null>(null);
  const sweepingRef = useRef(false);
  return {
    draft,
    setDraft,
    dismissed,
    setDismissed,
    plusOpen,
    setPlusOpen,
    modelOpen,
    setModelOpen,
    effortOpen,
    setEffortOpen,
    effortBox,
    setEffortBox,
    effortHovered,
    setEffortHovered,
    effortMenuLeft,
    setEffortMenuLeft,
    effortMenuBottom,
    setEffortMenuBottom,
    dragging,
    setDragging,
    fileInputRef,
    connected,
    setConnected,
    active,
    setActive,
    listening,
    setListening,
    expanded,
    setExpanded,
    wide,
    rowBox,
    setRowBox,
    engaged,
    setEngaged,
    modelBox,
    setModelBox,
    modelHovered,
    setModelHovered,
    modelMenuLeft,
    setModelMenuLeft,
    modelMenuBottom,
    setModelMenuBottom,
    composerAnchorRef,
    controlsRef,
    inputRef,
    measureRef,
    modelRef,
    rowRefs,
    modelRowRefs,
    effortRef,
    effortRowRefs,
    glimmRef,
    shaderRef,
    sweepingRef,
    RAINBOW,
  };
}
export type PromptState = ReturnType<typeof usePromptState>;
