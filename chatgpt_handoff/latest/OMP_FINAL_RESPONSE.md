# KCS Milestone F Item 10 Second Slice — Final Response (Masks + Track Mattes)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** done and merged. `feat/lottie-mask-matte-slice` was fast-forward merged into `main` at `8670b2a` (base `main` was `bf8632a`) and pushed; the branch is kept.
- **Report:** `reports/progress_125_lottie_mask_matte_slice.md`. **Design:** `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`.
- No UI entry point is wired yet: the importer returns a scene plus a loss report, and nothing in the editor calls it.

## 2) WHAT CHANGED

| File | Change |
|---|---|
| `src/interop/lottie/temporal.ts` | The segment-split timing decision moved into `mapLottieSegmentTiming`, so the numeric channels and the mask-geometry channel share one easing authority; `mapLottieKeyframes` is a thin value mapper over it |
| `src/interop/lottie/mapDocument.ts` | `mapLayerMasks` (mode map, static geometry, animated geometry and scalars, limit, unreadable payloads), the four track-matte types, `tp`/`td` handling, and mask channels on the layer's existing track; the path reader now accepts the specification's `[x, y]` pairs as well as `{ x, y }` objects |
| `src/interop/lottie/diagnostics.ts` | `LOTTIE_IMPORT_LIMITS.masksPerLayer: 8` restored |
| `src/tests/lottieImport.test.ts` | Mask/matte group with 19 cases (56 in total, was 37); fixtures moved to the specification's path form; the superseded blanket-report test re-pinned to the constructs that are still reported |
| `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` | §3/§5 record the specification facts this slice follows (`[x, y]` pairs, `td` as a 0/1 flag, `tp` reported, the limit counts source masks, unreadable fields reported) |

## 3) VALIDATION

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| `npx vitest run src/tests/lottieImport.test.ts` | PASS — 56 cases |
| `npm test` (full Vitest) | PASS — 120 files / 1,792 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium smoke tests, candidate `8670b2a` |
| `node scripts/check-state-consistency.mjs` | PASS once the handoff bundle mirrors the updated root documents (this refresh) |
| `git diff --check` | clean |

## 4) REVIEW

Three independent read-only review rounds (`reviewer-agent`, evidence-cited):

| Round | Verdict | Findings |
|---|---|---|
| 1 | BLOCKED | 3 high + 3 medium: the path reader ignored the specification's `[x, y]` pairs; `td` was misread as an index; animated mask-path timing diagnostics were dropped; the mask limit counted imported masks instead of source masks; present-but-unreadable mask fields fell back silently; one diagnostic path pointed at the wrong layer |
| 2 | BLOCKED | 4 findings closed; one partially open (`hasMask: true` with no mask list, and an animated scalar with no readable keyframe, still fell back silently) |
| 3 | READY | Every finding closed, no new blocker |

The first round's high findings were verified against the published Lottie specification before the fix: `v`/`i`/`o` are arrays of `[x, y]` pairs and `td` is a 0/1 flag with `tp` naming an explicit matte parent.

The review also surfaced a **pre-existing defect in the merged import core** that this slice fixes: the path reader only accepted `{ x, y }` objects, so real documents lost every shape path and mask.

## 5) SAFETY

- No UI, editor or import entry point; no evaluator or renderer change.
- No `package.json`, lockfile, dependency or workflow change; the changed paths are the Lottie importer, its tests and documentation.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the GitHub draft release, npm metadata, `origin/without-mask`, the OMP configuration (`memory.backend: mnemopi`, model roles, provider mappings, `task.maxConcurrency: 8`) and the user folders are unchanged.
- Integration was fast-forward only: no merge commit, no rebase, no force push, no tag change, no branch deletion.

## 6) NEXT

The next item-10 slice is **text/image/precomp conversion**, followed by the import entry point with
the report-before-replace UX (which is also where the imported layer type can be reconciled with the
OGraf export types). Everything that touches `package.json`, lockfiles or workflows stays behind its
own approval.
