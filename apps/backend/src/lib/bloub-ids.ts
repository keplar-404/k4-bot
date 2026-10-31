// Mirrors the bloub engine IDs in apps/web/src/lib/bloub/bot/{skins,expressions}.ts.
// Keep in sync when either side changes.

export const SHAPE_IDS = [
  "cercle",
  "galet",
  "squircle",
  "capsule",
  "triangle",
  "hexagone",
  "nuage",
  "goutte",
] as const;

export const COLOR_IDS = [
  "encre",
  "brun",
  "rouge",
  "orange",
  "ambre",
  "vert",
  "turquoise",
  "bleu",
  "violet",
  "rose",
  "gris",
  "creme",
] as const;

export const EXPRESSION_IDS = [
  "neutre",
  "attentif",
  "surpris",
  "excite",
  "heureux",
  "hilare",
  "colere",
  "triste",
  "effraye",
  "mefiant",
  "confus",
  "curieux",
  "fier",
  "timide",
  "blase",
  "somnolent",
] as const;
