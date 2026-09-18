# KCS Milestone F Item 12 (first step) — Final Response (Validated KCS Import Boundary)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** the approved item-12 **security half, first step** is implemented on branch `fix/kcs-import-boundary-hardening`, stacked on item 11 (`chore/evaluator-profiling-harness`) over `main` = `af0288de…`. Awaiting review and the user merge decision.
- **Report:** `reports/progress_119_kcs_import_boundary.md`.
- Scope confirmed by the user: the first editable kinds are the current `.kcs` scene and the legacy `AnimationProject` shape; OGraf package/single-file import stays rejected.

## 2) WHAT CHANGED

- `src/utils/importValidation.ts` (new): `validateImportedDocument(text)` runs cheapest-first — size (32 MB), JSON syntax, a depth-bounded walk for prototype-sensitive keys (reusing `isPrototypeSensitiveKey`), document shape, then declared layer/track count (5,000) — and returns a discriminated result with stable refusal codes (`KCS_IMPORT_TOO_LARGE`, `KCS_IMPORT_MALFORMED_JSON`, `KCS_IMPORT_UNSAFE_KEY`, `KCS_IMPORT_UNKNOWN_SHAPE`, `KCS_IMPORT_TOO_MANY_LAYERS`) plus the offending document path and an actionable message. Exceeding a limit is a refusal, never a silent clamp — trimming a user's project would be data loss.
- `src/hooks/useSerialization.ts`: `importProject` delegates to the boundary, returns `ImportResult` (`{ ok, diagnostics }`), and no longer parses into `any`; the legacy branch consumes the already-validated document and the catch-all reports `KCS_IMPORT_FAILED`.
- `src/context/AnimatorContext.tsx` follows the new return shape; `src/components/Header/HeaderBar.tsx` shows the diagnostic message **and** its action instead of a generic "Invalid project file format!".
- `src/tests/importValidation.test.ts` (new, 9 cases) pins the boundary: both kinds accepted, malformed JSON, unknown shape, oversize refused before parsing, prototype key top-level and nested with the path named, and the layer-limit refusal. Existing import-path tests were adapted to the result shape; no assertion was weakened.

## 3) VALIDATION

| Check | Result |
|---|---|
| Boundary cases | PASS — 9 cases |
| Serialization suite | PASS — 95 cases (round-trip, matte, appearance, freeform, migration) |
| Full suite | PASS — 118 files / 1,730 tests |
| Lint / TypeScript / build | clean / clean / PASS |
| Release gate | PASS — 2 Chromium tests |
| State consistency | PASS |

## 4) REVIEW

The change goes through the independent read-only review gate before any merge; the verdict is recorded here before the merge request.

## 5) SAFETY

- Both accepted document kinds still import exactly as before; only unsafe, malformed or oversized inputs changed behaviour (now refused with a reason). No dependency, `package.json`, lockfile or workflow change; no new path-safety authority was invented.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 6) NEXT

One decision: merge the stacked branch (items 11 and 12 first step and the item-10 mapping design) after the review passes. Only item 10’s *future implementation* needs its own branch, once the four design questions are settled. The remaining item-12 product work (compatibility matrix, round-trip guarantee, unified import UX, autosave routed through the boundary, OGraf package import) stays plan-only.
