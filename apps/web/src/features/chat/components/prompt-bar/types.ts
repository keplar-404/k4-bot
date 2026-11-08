export type ComposerAttachment = {
  key: string;
  name: string;
  progress: number;
  preview?: string;
};
export type ModelOption = {
  key: string;
  name: string;
  tag?: string;
  vision: boolean;
  reasoning: boolean;
  reasoningEfforts: string[];
};

export type PromptBarProps = {
  placeholder?: string;
  onSend?: (text: string) => void;
  onAttach?: (files: File[]) => void;
  attachments?: ComposerAttachment[];
  onRemoveAttachment?: (key: string) => void;
  busy?: boolean;
  /** The bot is working on a message: the send button becomes Stop. */
  responding?: boolean;
  onStop?: () => void;
  models?: ModelOption[];
  modelKey?: string;
  effort?: string | null;
  onSelect?: (modelKey: string, effort: string | null) => void;
  mode?: "allow_all" | "plan" | "ask";
  onModeChange?: (mode: "allow_all" | "plan" | "ask") => void;
};
