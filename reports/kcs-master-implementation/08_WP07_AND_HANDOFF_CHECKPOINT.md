# WP-07 checkpoint + session handoff (usage limit reached)

## WP-07 — Honest export/graph capability surfaces

- Confirmed validator bug (red tests first, 3 failing): `src/ograf/validation.ts` built matte edges
  from `trackMatte ?? matte` ignoring `enabled`, unlike the editor/stage/runtime (`resolveMatteSource`).
  A disabled relationship could block export (false cycle / missing source). Narrow fix: only the
  active relationship is an edge; reserved-id refusal kept. `src/tests/wp07OGrafMatteValidation.test.ts`.
- New `src/ograf/capabilityReport.ts` + `src/components/Header/OGrafCapabilityDialog.{tsx,css}` +
  Export menu item "Check OGraf Export…": per-layer Supported / Exports with warnings / Blocks export,
  derived only from the real export compile diagnostics; export button disabled while blocked.
- Graph surface verified unchanged and already honest (EDITABLE vs DERIVED · READ ONLY, units, HOLD).
- Evidence: unit 2 + 4 tests PASS; 23 OGraf test files / 296 tests PASS; `npm run validate:ograf` exit 0;
  `e2e/wp07-ograf-export-check.spec.ts` 2/2 PASS; screenshots `evidence/wp07/`.
- Export E2E subset (run from worktree root): 24 passed, 1 failed — `gif-export.spec.ts`
  "A1 guard … Save-and-reload keeps it". Diagnosis (base scratch copy of 39f6414 vs this worktree,
  same steps): in BOTH, Save-and-reload really reloads and the page shows fps 24, because the test's
  own `addInitScript` re-seeds the old scene on reload. The test passes only when its last assertion
  runs on the pre-reload page — a pre-existing timing race (base 3/3, here 1/3 in isolation). Not
  modified; needs a separate test fix decision.

IMPLEMENTED: YES · TESTED: PARTIAL (focused PASS; one pre-existing racy E2E) · USER ACCEPTED: PENDING · MERGED: NO

## Status table

| WP | IMPLEMENTED | TESTED | USER ACCEPTED | MERGED |
|---|---|---|---|---|
| WP-01 | YES | PASS | PENDING | NO |
| WP-02 | YES | PASS (V-T11 load-sensitive once, 3/3 isolated) | PENDING | NO |
| WP-03 | YES | PASS | PENDING | NO |
| WP-04 | YES | PASS | PENDING | NO |
| WP-05 | YES | PASS | PENDING | NO |
| WP-06 | YES | PASS | PENDING | NO |
| WP-07 | YES | PARTIAL | PENDING | NO |

## Not run before the limit

Final full Vitest/tsc/lint/build after WP-04..WP-07 (last full Vitest: 204 files / 3026 PASS after
WP-03; tsc/lint checked after each later change), and a full E2E suite run.

## Protection check (final)

Main and Sprint 1: status, tracked diff and untracked-file SHA-256 identical to the start snapshot.
Worktree HEAD still `39f6414`; all changes uncommitted. QA ports 5196/5197 closed.
Scratch base copy for diagnosis lives only in the session scratchpad.

## How to try it

```
cd C:\Users\ertugrul.ak\Desktop\kcs-master-implementation
npx vite --host 127.0.0.1 --port 5196 --strictPort
```
Open http://127.0.0.1:5196 (fresh origin; frontend only, no backend).
