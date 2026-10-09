# Progress 157 — Reality Hub OGraf layer order and track matte parity

Date: 2026-10-09. Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.

Reality Hub manual QA after the rc.2 publication reported two OGraf portability defects: the layer stacking was inverted for a template without a matte, and a template with a track matte did not surface at all. The first is reproduced, root-caused and fixed here. The second is narrowed to the same runtime defect; no matte-specific defect could be reproduced locally.

## Candidate identity

| Field | Value |
|---|---|
| **OLD PUBLIC RC.2 SHA** | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` — the published rc.2 prerelease, unchanged |
| **NEW FIXED CODE SHA** | `8968abfe6861bb7299756e885d915f7fd794fce5` |
| Branch | `fix/reality-hub-ograf-layer-matte-parity`, fast-forward merged into `main`, kept |
| Prior main | `fa63c29` (docs tip of the rc.2 publication) |

## Root cause — layer order (PROVEN KCS bug)

Three ordering facts disagreed:

| Authority | Rule |
|---|---|
| `StageCanvas` (`sortedParts`) | ascending `zIndex` paints first → higher `zIndex` on top |
| `evaluateFrame:117` | `evaluated.sort((a, b) => a.zIndex - b.zIndex)` — the same rule |
| `toSceneData` array | the authored array, which is **descending** `zIndex`: `addCustomPart` prepends with `max + 1` and `reorderParts` assigns `zIndex = total - index` |
| `runtimeTemplate.evaluateScene` | `scene.layers.map(...)` — **array order**, never sorted |
| `svgRenderer` paint list | `scene.layers.map(...)` — array order, correct only because its caller is pre-sorted |

`graphic.mjs` is what an OGraf host loads, so the runtime painted the array front-to-back: index 0 (the topmost layer in the editor) was drawn FIRST and therefore ended up at the bottom. That is exactly the reported "fish is above lake in KCS but below in Reality Hub".

The static `svgRenderer` output and the editor both looked correct, which is why the defect only appeared in a host consuming the runtime.

## Root cause — track matte (NARROWED, not a separate defect)

The matte emission itself is structurally valid, verified on both paths:

- `<mask id maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="...">` in `<defs>`, and the target carries `mask="url(#id)"` for an id the same document defines.
- The mask-only source is excluded from the painted list when the contract says `sourceVisible: false`, and keeps its sibling position when it is visible.
- The target keeps its own stacking position and resolves its source whether the source is authored above or below it.

The reported "the template does not appear at all with a matte" is consistent with the ordering defect emptying the frame: the matte makes its source mask-only, so the only remaining painted layers are the target and any other sibling — and those were being drawn in the inverted order. No host-specific rule is claimed here; the remaining question belongs to the Reality Hub retest below.

## Fix

`src/utils/stackingOrder.ts` is the one authority:

```ts
export const compareByStackingOrder = (a, b) => a.zIndex - b.zIndex;
export const stackingOrder = (items) => [...items].sort(compareByStackingOrder);
```

Ascending `zIndex` paints first, `Array.prototype.sort` is stable so a shared `zIndex` keeps the authored order, and a copy is always sorted so the input array is never mutated.

Applied at every painter's-model site: `StageCanvas` (the stage), `evaluateFrame` (the frame evaluator), `svgRenderer` (the static SVG) and `runtimeTemplate` (the generated runtime, which inlines the comparator the way it inlines its other mirror helpers).

Nothing else changed: the OGraf package structure, `scene.kcs`, public controls, asset packaging, path security, mask/matte semantics and matte parity behaviour are untouched.

## Regression

`src/tests/ografLayerStacking.test.ts` — 13 cases: two layers, three layers, the stable tie, array immutability, the packaged runtime, and the matte matrix (mask-only source, unrelated sibling, `sourceVisible: true`, source authored below the target, mask id resolution).

**Proof it catches the defect:** reverting only the runtime sort turns four cases red, reporting `['fish','lake']` where `['lake','fish']` is required.

## Validation

`npx tsc -b --pretty false`, `npm run lint`, `npm test` (136 files / 2,079 tests), `npm run build`, `npm run validate:ograf`, `npm run qa:release` (2 Chromium), `npm run qa:v6` (3 Chromium), `npx playwright test --project=chromium --retries=0` (265 tests), `node scripts/check-state-consistency.mjs`, `npm audit --audit-level=low` (0 vulnerabilities) and `git diff --check` all pass.

## Reality Hub retest artifacts

Two packages were compiled with the fixed authorities and written outside the repository:

```
C:\Users\ertugrul.ak\AppData\Local\Temp\kcs-reality-hub-retest\reality-hub-layer-order-repro-fixed.zip
C:\Users\ertugrul.ak\AppData\Local\Temp\kcs-reality-hub-retest\reality-hub-track-matte-repro-fixed.zip
```

- `reality-hub-layer-order-repro-fixed.zip` — a full-frame `lake` under a smaller `fish`, both authored with the outliner order (array index 0 = top). Expected: the fish is visible on top of the lake.
- `reality-hub-track-matte-repro-fixed.zip` — the same pair plus a `lens` circle as the fish's alpha track-matte source with `sourceVisible: false`. Expected: the fish appears with the lens-shaped alpha cut and the lake stays visible behind it.

Both contain `manifest` + `scene.kcs` + `graphic.mjs`. They are QA outputs, not tracked source; the user copies them into the Reality Hub OGraf projects folder.

## Remaining question for the user

The layer-order fix is proven locally by the regression and by the pre-fix/fix comparison. **Reality Hub itself has not been exercised** — that retest belongs to the user. If the track-matte package still fails to surface in Reality Hub while the layer-order package works, the remaining evidence is host-side and the next step is to capture the host's own error/report for that specific package.
