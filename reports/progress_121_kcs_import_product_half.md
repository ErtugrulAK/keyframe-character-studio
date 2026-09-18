# Progress 121 — KCS Import Product Half: Compatibility Matrix, Migration Report, Autosave Boundary

## 1. Scope

The approved item-12 product-half step, continuing `reports/progress_119_kcs_import_boundary.md`: the supported document kinds are now an executed matrix, a legacy import **reports** the migration it will run instead of succeeding silently, and the autosave restore path goes through the same validated boundary as an imported file.

## 2. Branch

- `feat/kcs-import-product-half`, based on `main` at `44218a62ff48a090e5f94ce6331ec2578332ce5d` (Milestone F stack merged and green).

## 3. What changed

- **`src/utils/importValidation.ts`**
  - `LegacyProjectDocument` now names the optional fields the legacy application path reads (`fps`, `totalFrames`, `projectResolution`, `motionTemplates`, `activeTemplateId`, `coordinateSystem`, `lastSavedTime`, `sceneTitle`, `name`) as `unknown`, and **every one of them goes through a narrowing helper** before it reaches state: `readOptionalNumber` (finite number), `readOptionalString`, `readProjectResolution` (both dimensions finite and positive), `readMotionTemplates` (array of objects with string `id`/`name`), and the existing `isSceneCoordinateSystem` guard for the coordinate contract. `tracks` and `characterParts` stay proven arrays.
  - A review round found the first version narrowed only some of those fields (truthiness plus casts on `projectResolution`, the import branch's `fps`/`totalFrames`, `motionTemplates`, `activeTemplateId` and `coordinateSystem`); this branch closes that gap, so the report's claim is now true rather than aspirational.
  - A successful legacy import now carries one **warning** diagnostic, `KCS_IMPORT_LEGACY_MIGRATED`, with the action ("review the imported template and export it again to store the current format"). A current scene import stays report-free.
- **`src/hooks/useSerialization.ts`**
  - `importProject` returns the validation's diagnostics with the success result, so warnings reach the UI.
  - The legacy import branch reads `sceneTitle`/`name` through `typeof` narrowing.
  - **Autosave restore** (`localStorage` → `AUTOSAVE_STORAGE_KEY`) now calls `validateImportedDocument` first: a corrupted or tampered entry is refused with a `console.warn` naming the code and message, and the defaults stay in place; a valid entry is applied through the same scene/legacy branches as before. The now-unused local `isSceneData` helper was deleted (the boundary owns that decision).
- **`src/components/Header/HeaderBar.tsx`** — a successful import that carries warnings shows the success toast **and** an `info` toast with the warning's code, message and action.
- **Tests**
  - `src/tests/importCompatibilityMatrix.test.ts` (new, 5 cases): scene v1 and v2 apply with no report; the legacy project applies and reports exactly the migration warning; a scene never reports a migration; a non-project document is refused with `KCS_IMPORT_UNKNOWN_SHAPE`.
  - `src/tests/useSerialization.test.ts`: one new case proving a prototype-poisoned autosave payload is refused (the warning names `KCS_IMPORT_UNSAFE_KEY`) and no state setter runs.

## 4. Validation (branch `feat/kcs-import-product-half`)

| Check | Command | Result |
|---|---|---|
| Compatibility matrix | `npx vitest run src/tests/importCompatibilityMatrix.test.ts` | PASS — 5 cases |
| Serialization suite | `npx vitest run src/tests/useSerialization.test.ts` | PASS — 96 cases (including the autosave refusal) |
| Full suite | `npm test` | PASS — 119 files / 1,736 tests |
| Lint / TypeScript / build | `npm run lint`, `npx tsc --noEmit`, `npm run build` | clean / clean / PASS |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| State consistency | `node scripts/check-state-consistency.mjs` | PASS |

## 5. Protected invariants

- Both document kinds import exactly as before; the additions are a warning for the legacy kind and a *refusal* for a corrupted autosave entry that previously would have been applied (or crashed).
- The autosave key, its writer, and the export paths are unchanged; no dependency, `package.json`, lockfile or workflow change; no new path-safety authority.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 6. Residual risks

- **Autosave refusal keeps defaults.** If a user's autosave is corrupted, they land on an empty project with a console warning rather than a crash; a user-visible notice for that case is a UI decision that has not been taken.
- **Element-level legacy validation is still shallow.** The boundary proves arrays and rejects prototype keys; a malformed *element* field still degrades where it always did.
- **OGraf package import remains out of scope** and is still rejected with the dedicated toast.

## 7. Still plan-only

1. A unified import entry point that shows the full migration/loss report before replacing work (today: refusal toast, or the migration warning after apply).
2. Item 10 implementation (Lottie importer) — design approved, implementation needs its own branch and slices.
3. OGraf package/single-file import.
