export function nameCaretLookImpl(el: HTMLInputElement | null): {
  nx: number;
  ny: number;
} {
  if (!el) return { nx: 0, ny: 0.6 };
  const pos = el.selectionStart ?? 0;
  const col = pos;
  const nx = (col / 20) * 2 - 1;
  return { nx: Math.max(-1, Math.min(1, nx)), ny: 0.6 };
}

export function caretLookImpl(el: HTMLTextAreaElement | null): {
  nx: number;
  ny: number;
} {
  if (!el) return { nx: 0, ny: 0.4 };
  const pos = el.selectionStart ?? 0;
  const before = el.value.slice(0, pos);
  const lines = before.split("\n");
  const lineIndex = lines.length - 1;
  const col = lines[lines.length - 1].length;
  const totalLines = Math.max(el.value.split("\n").length, 1);
  const ny = 0.5 + (lineIndex / Math.max(totalLines - 1, 1)) * 0.4;
  const nx = (col / 40) * 2 - 1;
  return {
    nx: Math.max(-1, Math.min(1, nx)),
    ny: Math.max(-1, Math.min(1, ny)),
  };
}
