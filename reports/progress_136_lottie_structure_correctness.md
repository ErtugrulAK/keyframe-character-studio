# Progress 136 — Task C: Lottie structure correctness

Branch: `fix/lottie-structure-correctness` (base `main` at `fc672f2`).
Findings: **H-05** (multiple geometry silently overwritten), **M-01** (parent resolved by array offset instead of `ind`), **M-02** (a static child skipped its parent transform).

## 1. What was open

1. **M-01.** `mapDocument` read `layer.parent` as an **array position** (`lottie-layer-${parent}`, guarded by `parent < index`) and used that same assumption to count the hierarchy depth. Lottie's `parent` names the parent layer's own `ind` — in typical exports `ind` is 1-based, so the resolution was off by one *and* it refused any document where a child precedes its parent.
2. **M-02.** `evaluateTransform` returned the base transform as soon as a layer had no animation track, before the parent chain was resolved. The same scene placed a child correctly when the child carried an (empty) track and at its local position when it did not — the animation track decided the hierarchy.
3. **H-05.** `sh`, `rc` and `el` each assigned `layerShape.path`, so a layer carrying more than one geometry item kept only the last one, with no report.

## 2. M-01 — parent references resolve by `ind`

The parent relation is now resolved **after** the layer loop:

- each imported layer registers its `ind` in an `ind → layer id` map (`lottie-layer-${arrayIndex}` stays the id);
- each layer that declares `parent` is recorded as a pending relation, and the loop no longer requires the parent to sit earlier in the array;
- after the loop the relation resolves through the map; an `ind` no imported layer declares, or a layer that names itself, is reported as `LOTTIE_BROKEN_PARENT` and leaves the layer unparented;
- an `ind` two imported layers share is reported once as `LOTTIE_DUPLICATE_LAYER_INDEX` (the first declaration keeps the reference, so the relation stays deterministic);
- the depth check walks the **resolved** graph with a visited set, so a malformed cycle terminates and is not reported as depth.

**Backward compatibility, stated plainly:** a document that declares `parent` without `ind` used to have its parent guessed from the array position. It is now reported as broken. That guess was the defect — and the one test fixture built on it was corrected to declare `ind` (the contract it checks, "a chain deeper than the limit is reported", is unchanged).

## 3. M-02 — the hierarchy is resolved for every layer

```ts
// A layer with no animation track still inherits its parent: only the keyframe
// evaluation is skipped here, never the hierarchy resolution.
const rawTransform = track ? evaluateKeyframes(track, baseTransform, frame, activeTmpl) : baseTransform;
```

The anchor override, the cycle guard and the parent composition are untouched; only the early return is gone. A consequence worth naming: a layer with a `parentId` or `booleanGroupId` and no track now inherits its parent, where before it stood still — that is the fix, and it applies to every KCS scene, not only to imported Lottie ones.

## 4. H-05 — no silent loss

A layer's geometry items are counted while its shapes are read; when more than one is found the import reports `LOTTIE_MULTIPLE_GEOMETRY` naming the count and the shape indexes, and says which one is kept. The layer still imports. Nothing else about the mapping changed: a KCS layer draws exactly one path, so "report what cannot be represented" is the contract this importer already uses for every other unsupported construct.

## 5. Evidence

| Finding | Reproduction |
|---|---|
| M-01 | 4 of the new/changed cases fail with the array-index interpretation (`resolves a parent by the layer index it names`, `keeps a parent cycle out of the depth check`, `reports a layer index two imported layers share`, `reports a parent chain deeper than the hierarchy limit`) |
| M-02 | 3 new cases fail without the fix (static child, nested static chain, helper parent) |
| H-05 | the new case fails without the report |

The one pre-existing fixture that failed against the first cut was the hierarchy-limit case, whose document declared no `ind` at all; it now declares the indexes a real document carries and asserts both the limit report and the absence of a broken-parent report.

## 6. Validation

| Check | Result |
|---|---|
| `npm test` | PASS — 125 files / 1,913 tests |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests, candidate `fc672f2` |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 3 tests |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 7. Self-review (read-only, same model)

- **Cost.** Parent resolution is a linear pass over the declared relations with map lookups; the depth walk stops at the import limit or at a cycle, so it is bounded per layer. No nested scans were introduced.
- **Determinism.** A duplicated `ind` keeps the first declaration and is reported, so the same document always resolves to the same parent.
- **Blast radius of M-02.** Any trackless layer with a parent now moves. That is the intended contract (`evaluateFrame`'s own stage list says "Hierarchy — parent-child world transform"), and the existing hierarchy suite passes unchanged.
- **The build is the real type gate.** `npx tsc --noEmit` checks **zero** project files here: the root `tsconfig.json` is a solution file (`files: []`) with references, and `--noEmit` does not build them. `tsc -b --listFiles` reports 151 source files; `npx tsc --noEmit --listFiles` reports none. A missing binding introduced during this task (`rawTransform`) was caught by `npm run build` and not by the documented `npx tsc --noEmit`. **Not changed here** — CI and the documented validation steps are outside this finding's scope and need their own approval; recorded so the next reader does not trust a step that verifies nothing.
- **`zIndex` still follows the array position** (`lottieLayers.length - index`). That is the drawing order Lottie's own list defines, and it is independent of the `ind` graph, so it was left alone.

## 8. Not changed

- The map-or-report contract, every other Lottie diagnostic, the channel mapping and the precomp reporting are untouched.
- No new dependency, script, workflow, tag or release action.
- No change to the CI workflow, including the type-check step noted above.
