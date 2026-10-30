# Bloub Avatar (frontend lib)

Ported from `jeremy-prt/bloub` (MIT). Framework-free engine preserved under `bot/`.

## Modules

- `bot/engine.ts` — `BotEngine` with `sample(t)`, `setState`, `setShape`, `setExpression`, `setLook`, `reset`. Pure function of time; no framework, no clock.
- `bot/skins.ts` — `SHAPES`, `COLORS`, `SHAPE_BY_ID`, `COLOR_BY_ID`, `mixHex`.
- `bot/expressions.ts` — `EXPRESSIONS`, `EXPRESSION_BY_ID`, `blendExpression`.
- `bot/states.ts` — `STATES`, `POSES`, `SEQUENCE` (animated states).
- `bot/profiles.ts`, `shape.ts`, `math.ts`, `repere.ts`, `face.ts`, `eyefit.ts`, `decor.ts` — geometry/measurement constants (do not alter).
- `bot/cycles.ts` — montage/cycle model (animation timeline).
- `ui/gaze.ts`, `ui/intro.ts`, `ui/stockage.ts` — gaze/intro/storage helpers.

## Frozen avatar (current usage)

`BloubAvatar` renders a single frame via `engine.sample(frozenAt)` (default 1s idle pose). No animation loop. Props: `shape`, `color`, `expression`, `size`, `paper`, `frozenAt`.

## Re-enabling animation later

1. Add `requestAnimationFrame` loop in `BloubAvatar` (mirror `BloubBot.vue` tick).
2. Wire `playing`, `block`, `elapsed` models and `cycle` prop.
3. Use `engine.setState` on block changes, `engine.sample(clock)`.
4. Gaze tracking: call `engine.setLook` from pointer events (see `aim()` in BloubBot.vue).
5. Export: use `rendAt(t)` for frame-by-frame capture (see `src/ui/capture.ts` in bloub).

All engine code is preserved and unmodified; only the React rendering is frozen.

## Customizer

`BloubCustomizer` (shadcn-based) edits shape/color/expression. Persisted to localStorage under `k4bloub:avatar`.
