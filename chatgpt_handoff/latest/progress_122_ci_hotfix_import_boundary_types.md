# Progress 122 — CI Hotfix: Import Boundary Type Errors and the Correct Type Gate

## 1. What went wrong

Two real type errors reached `main` inside `src/utils/importValidation.ts` (added by the item-12 first step, `reports/progress_119_kcs_import_boundary.md`):

1. `SceneData` was imported from `../types/animator`, where it does not exist (it lives in `../types/composition`).
2. `declaredLayerCount` read `document.scene.characterParts`, which `SceneData` does not have (a scene has `layers`).

Both were invisible to the gate this session used, `npx tsc --noEmit`, because that command type-checks the root program while the repository's build runs **`tsc -b`** (project build mode) with a different file set and project references. CI runs `npm run build` (`tsc -b && vite build`) and failed:

```
##[error]src/utils/importValidation.ts(1,30): error TS2305: Module '"../types/animator"' has no exported member 'SceneData'.
```

Runs `35342458687` (`44218a6`) and `35349298911` (`2d14397`) both failed on the same line; the second failure surfaced the follow-on error once the first was fixed. The earlier `progress_119`/`progress_121` validation rows claiming "TypeScript: clean" cited `npx tsc --noEmit`, which was the wrong command — the claim is corrected here and the gate is now `npm run build`.

## 2. The fix (branch `fix/import-validation-scene-data-type`)

- `SceneData` is imported from `../types/composition`.
- `declaredLayerCount` counts `scene.layers.length + scene.tracks.length` for a scene document.
- `isSceneDocument` now proves the shape it claims: a numeric `version` of at least 1 **and** `Array.isArray(layers)` **and** `Array.isArray(tracks)`. Checking `version` alone accepted a document the serializer cannot apply — the same class of looseness that let the two errors hide.
- The boundary's tests now use a real scene fixture shape (`layers` + `tracks`) instead of a `characterParts` object, in both `src/tests/importValidation.test.ts` and `src/tests/importCompatibilityMatrix.test.ts`, and the prototype-path assertion follows the document path it exercises (`layers[0].prototype`).

## 3. Validation (branch `fix/import-validation-scene-data-type`)

| Check | Command | Result |
|---|---|---|
| Type gate (the one CI uses) | `npm run build` (`tsc -b && vite build`) | PASS — no errors, bundle built |
| Full suite | `npm test` | PASS — 119 files / 1,736 tests |
| Lint | `npm run lint` | clean |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| State consistency | `node scripts/check-state-consistency.mjs` | PASS |

## 4. Process correction (recorded, not just fixed)

- **The type gate is `npm run build`, not `npx tsc --noEmit`.** Both are in the repository's own validation list, but only `tsc -b` covers the project references CI builds; every later validation table must cite `npm run build`, and `npx tsc --noEmit` alone is not sufficient evidence.
- A CI failure is the *last* line of defence for this class, so the local run order becomes: `npm run build` before the suite, on every branch that changes types.

## 5. Protected invariants

- The boundary's behaviour is unchanged for valid documents; the shape check is now *stricter* (a `version`-only object is refused as an unknown shape instead of crashing the layer count).
- No dependency, `package.json`, lockfile or workflow change; no change outside `src/utils/importValidation.ts` and the two test files.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.
