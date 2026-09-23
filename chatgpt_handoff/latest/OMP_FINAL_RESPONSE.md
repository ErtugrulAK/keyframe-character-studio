# KCS Post-Review Correctness Fix — Task D Final Response (OGraf inverse alpha matte)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** implemented on `fix/ograf-inverse-alpha-matte` (base `main` at `85c3929`); the merge decision is with the user.
- **Report:** `reports/progress_137_ograf_inverse_alpha_matte.md`.
- **Finding closed:** H-02 — the OGraf inverse alpha matte did not invert alpha.

## 2) WHAT WAS WRONG

The export renderer and the generated runtime built an inverted alpha matte as an **alpha** mask holding a white full-region path plus the source painted black. In an alpha mask, black paint keeps its alpha at 1, so the "hole" stayed opaque: the target rendered as if it had no matte at all. Measured in Chromium before the change — inside the source `255`, outside `255`.

The editor's own matte authority already documented and used the correct technique, and its browser specs pinned the outcome. The export renderer had drifted from that authority.

## 3) THE MEASURED ROOT CAUSE

A probe of five mask formulations in Chromium decided the fix:

| Formulation | Inside source | Outside source |
|---|---|---|
| alpha mask + white backdrop + black source (**what was emitted**) | opaque | opaque |
| luminance mask + white backdrop + black source | **transparent** | **opaque** |
| alpha mask with a single evenodd hole path | transparent | opaque |
| alpha mask with the source painted white (the normal case) | opaque | transparent |

The luminance form is the only one that is both correct and general: an evenodd hole needs the source geometry as a path, which text and image sources cannot provide.

## 4) WHAT CHANGED

- An inverted matte now emits a **luminance** mask with a white backdrop and the source painted black — the technique the editor documents — and declares the model it uses while its id keeps naming the relationship.
- **The sibling branch had the same defect**, found by the new pixel test: the inverted *luminance* matte had no backdrop, so the mask was transparent everywhere outside the source (inside `255`, outside `0`). Both inverted modes now share one construction and the `feComponentTransfer` branch is gone.
- **Text matte sources are painted black.** The text renderer emitted its own `fill` and appended the caller's, so a browser used the layer colour and a dark text produced no hole; the override now replaces the layer's paint, which also removes the duplicate, invalid attributes that path emitted.
- The generated runtime mirrors all of it, including a `fillOverride` argument on its `text()`, so the two renderers cannot drift apart.

## 5) EVIDENCE

A new browser spec, `e2e/ograf-matte-visual.spec.ts`, rasterizes the real exported SVG in Chromium and samples the alpha inside the source and inside the target but outside the source:

| Case | Before | After |
|---|---|---|
| inverted alpha | fail (opaque everywhere) | inside transparent, outside opaque |
| inverted luminance | fail (transparent outside) | inside transparent, outside opaque |
| generated runtime, inverted alpha | fail | matches the canonical renderer pixel for pixel |
| normal alpha (regression guard) | pass | pass |

The unit test that asserted `fill-rule="evenodd"` (a no-op on a single subpath) and the `fill="black"` string was replaced: it pinned the broken construction instead of its result. It now pins the mask model and the two paints for both renderers, plus that a normal alpha matte still declares `mask-type="alpha"` with no backdrop.

## 6) VALIDATION

| Check | Result |
|---|---|
| `e2e/ograf-matte-visual.spec.ts` | PASS — 4 pixel cases (3 fail against the pre-fix code) |
| `src/tests/ografGeneratedParity.test.ts` | PASS — 9 tests |
| `npm test` | PASS — 125 files / 1,914 tests |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests, candidate `85c3929` |
| `e2e/track-matte.spec.ts` (the editor's own matte suite) | PASS — 82 tests in 4.8 min |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 7) SELF-REVIEW NOTES

- One construction for both inverted modes, taken from the editor authority rather than invented, so the export matches what the editor shows.
- The mask id is unchanged, so references and diagnostics keep working; the normal (non-inverted) path is byte-for-byte what it was.
- Image sources cannot be repainted, so the luminance mask reads the image's own luminance — exactly what the editor does for an inverted image matte, and its spec asserts that structure.
- `renderText` only takes the changed branch when a caller passes paint (the matte path), so ordinary text rendering is untouched.

## 8) NEXT

- Task E (API trust boundary: H-06), then F (profiler fixtures: M-04) and G (live docs and the state checker: M-05) — each on its own branch with its own validation and merge gate.
