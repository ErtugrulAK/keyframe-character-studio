# Progress 119 — KCS Import Boundary Hardening (Milestone F, item 12, first step)

## 1. Scope

The approved item-12 plan, **security half, first step**: a single validated boundary turns imported project text into a typed document instead of `JSON.parse` into `any`. Product-half items (compatibility matrix, round-trip guarantee per kind, import UX beyond the refusal toast) remain plan-only and are named in §7.

Scope confirmed by the user: the first editable kinds are the current `.kcs` scene and the legacy `AnimationProject` shape; OGraf manifest/package import stays rejected as before.

## 2. Branch

- `fix/kcs-import-boundary-hardening`, stacked on `chore/evaluator-profiling-harness` (item 11) over `main` = `af0288de…`.

## 3. What changed

- **`src/utils/importValidation.ts` (new)** — the boundary:
  - `validateImportedDocument(text)` runs cheapest-first checks and returns a discriminated result: size limit → JSON syntax → prototype-sensitive keys (deep, depth-bounded walk reusing `isPrototypeSensitiveKey` from `src/utils/pathSafety.ts`) → document shape → declared layer/track count.
  - Limits: `MAX_IMPORT_CHARACTERS` 32 MB, `MAX_IMPORT_LAYERS` 5,000, `MAX_IMPORT_DEPTH` 64. Exceeding a limit is a **refusal with a diagnostic**, never a silent clamp: trimming a user's project would be data loss, and a refusal tells them exactly what to do.
  - Diagnostics reuse the export-diagnostics shape (`code`, `severity`, `feature`, `path`, `message`, `action`), with stable codes (`KCS_IMPORT_TOO_LARGE`, `KCS_IMPORT_MALFORMED_JSON`, `KCS_IMPORT_UNSAFE_KEY`, `KCS_IMPORT_UNKNOWN_SHAPE`, `KCS_IMPORT_TOO_MANY_LAYERS`, `KCS_IMPORT_FAILED`) and the offending document path (`$.characterParts[0].prototype`) so the author can find it.
- **`src/hooks/useSerialization.ts`** — `importProject` now delegates to the boundary and returns `ImportResult` (`{ ok, diagnostics }`) instead of a bare boolean. The `JSON.parse` into `any` and the post-hoc narrowing are gone; the legacy branch consumes the already-validated `legacy-project` document, and the catch-all path reports `KCS_IMPORT_FAILED` instead of swallowing the reason.
- **`src/context/AnimatorContext.tsx`** — the context type follows the new return shape.
- **`src/components/Header/HeaderBar.tsx`** — the refusal toast shows the diagnostic's message **and** its action instead of a generic "Invalid project file format!".
- **`src/tests/importValidation.test.ts` (new)** — 9 cases: scene and legacy acceptance, malformed JSON, unknown shape, oversized document refused before parsing, prototype key at the top level and nested (with the path named), message/action present, and the layer-limit refusal.
- **Test adaptations** — `src/tests/useSerialization.test.ts` and `src/tests/ografBrowserZip.test.tsx` assert the new result shape (`imported.ok`); no assertion was weakened or removed.

## 4. Validation (branch `fix/kcs-import-boundary-hardening`)

| Check | Command | Result |
|---|---|---|
| Boundary cases | `npx vitest run src/tests/importValidation.test.ts` | PASS — 9 cases |
| Serialization suite | `npx vitest run src/tests/useSerialization.test.ts` | PASS — 95 cases (round-trip, matte, appearance, freeform, migration) |
| Full suite | `npm test` | PASS — 118 files / 1,730 tests |
| Lint / TypeScript | `npm run lint`, `npx tsc --noEmit` | clean / clean |
| Build | `npm run build` | PASS |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| State consistency | `node scripts/check-state-consistency.mjs` | PASS |

## 5. Protected invariants

- Both accepted document kinds still import exactly as before; only the *unsafe, malformed or oversized* cases changed behaviour (they are now refused with a reason).
- No dependency, `package.json`, `package-lock.json` or workflow change; no new path-safety authority (the existing `isPrototypeSensitiveKey` is reused).
- OGraf manifest/package rejection is unchanged.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 6. Residual risks

- **Legacy branch trusts the shape, not every field.** The boundary proves `tracks` and `characterParts` are arrays and that no prototype-sensitive key exists; field-level validation of a legacy document still happens where it always did (the migration helpers). A malformed *field* therefore degrades as before, not worse.
- **Refusal, not repair.** A document that exceeds a limit is refused. If a real project ever legitimately exceeds 5,000 layers or 32 MB, the limit needs raising — that is a deliberate, visible decision rather than a silent truncation.
- **Autosave path unchanged.** `localStorage` restore still parses its own payload (it is written by this app, not imported). Bringing it onto the same boundary is a natural follow-up and is listed in §7.

## 7. Still plan-only (item 12 product half and follow-ups)

1. Compatibility matrix executed as fixtures per document kind.
2. Round-trip guarantee per kind, with a loss report instead of dropped fields.
3. One import entry point that detects the kind and shows the migration/loss report before replacing work.
4. Route the `localStorage` autosave restore through the same boundary.
5. OGraf package/single-file import (explicitly out of the first scope).
