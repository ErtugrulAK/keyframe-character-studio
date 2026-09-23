# KCS Post-Review Correctness Fix — Task C Final Response (Lottie structure correctness)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** implemented on `fix/lottie-structure-correctness` (base `main` at `fc672f2`); the merge decision is with the user.
- **Report:** `reports/progress_136_lottie_structure_correctness.md`.
- **Findings closed:** M-01 (parent resolved by array offset instead of `ind`), M-02 (a static child skipped its parent transform), H-05 (multiple geometry silently overwritten).

## 2) M-01 — a parent reference names a layer index, not an array position

`mapDocument` read `layer.parent` as an array position (`lottie-layer-${parent}`, and only when the parent sat earlier in the array), and used the same assumption for the depth count. Lottie's `parent` names the parent layer's own `ind`, which in typical exports is 1-based — so the resolution was off by one *and* it refused any document where a child precedes its parent.

The relation is now resolved after the layer loop: each imported layer registers its `ind`, each `parent` becomes a pending relation, and the references resolve through that map. An `ind` no imported layer declares, or a layer naming itself, is reported as `LOTTIE_BROKEN_PARENT`; an `ind` two layers share is reported once as `LOTTIE_DUPLICATE_LAYER_INDEX` and the first declaration keeps the reference, so the result is deterministic; the depth check walks the resolved graph with a visited set, so a malformed cycle terminates.

**Backward compatibility, stated plainly:** a document declaring `parent` without `ind` used to have its parent guessed from the array position; it is now reported as broken. That guess was the defect, and the one fixture built on it was corrected to declare `ind` while keeping the contract it checks.

## 3) M-02 — the hierarchy is resolved for every layer

`evaluateTransform` returned the base transform as soon as a layer had no animation track, before the parent chain was resolved: the same scene placed a child correctly when it carried an (empty) track and at its local position when it did not. Only the early return is gone; the anchor override, the cycle guard and the parent composition are untouched. This applies to every KCS scene, not only to imported Lottie ones.

## 4) H-05 — no silent loss

A layer's geometry items are counted while its shapes are read; more than one now reports `LOTTIE_MULTIPLE_GEOMETRY` naming the count, the shape indexes and which one is kept. The layer still imports. A KCS layer draws exactly one path, so this is the same map-or-report contract the importer already uses for every other construct it cannot represent.

## 5) EVIDENCE

- **M-01:** 4 of the new/changed cases fail with the array-index interpretation.
- **M-02:** 3 new cases fail without the fix (static child, nested static chain, helper parent).
- **H-05:** the new case fails without the report.

## 6) VALIDATION

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

## 7) SELF-REVIEW NOTES

- Parent resolution is a linear pass with map lookups; the depth walk stops at the import limit or at a cycle, so it is bounded per layer.
- A duplicated `ind` keeps the first declaration and is reported, so the same document always resolves to the same parent.
- **The build is the real type gate here.** `npx tsc --noEmit` checks **zero** project files: the root `tsconfig.json` is a solution file (`files: []`) with references, and `--noEmit` does not build them (`tsc -b --listFiles` reports 151 source files; `npx tsc --noEmit --listFiles` reports none). A missing binding introduced during this task was caught by `npm run build`, not by that command. Recorded, not changed — the CI workflow and the documented validation steps are outside this finding's scope and need their own approval.
- `zIndex` still follows the array position (`lottieLayers.length - index`), which is the drawing order Lottie's own list defines and is independent of the `ind` graph.

## 8) NEXT

- Task D (OGraf inverse alpha matte: H-02), then E (API trust boundary: H-06), F (profiler fixtures: M-04), G (live docs and the state checker: M-05) — each on its own branch with its own validation and merge gate.
