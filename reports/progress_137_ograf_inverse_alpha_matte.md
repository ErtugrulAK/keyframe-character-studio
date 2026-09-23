# Progress 137 — Task D: the OGraf inverse alpha matte

Branch: `fix/ograf-inverse-alpha-matte` (base `main` at `85c3929`).
Finding: **H-02** — the OGraf inverse alpha matte did not invert alpha.

## 1. What was open

The export renderer (`src/ograf/svgRenderer.ts`) and the generated runtime
(`src/ograf/runtimeTemplate.ts`) built an inverted alpha matte as an **alpha** mask holding a white
full-region path plus the source painted black. In an alpha mask, black paint keeps its alpha at 1,
so the "hole" stayed opaque: the target rendered as if it had no matte at all. Measured in Chromium
before the change — inside the source `255`, outside `255` (fully opaque everywhere).

The editor's own matte authority already documents and uses the correct technique
(`src/utils/matte.ts`: *"luminance inverted: white region rect + BLACK geometry path"*, and for the
alpha case an evenodd hole or a luminance structure), and its browser specs pin the outcome
(`e2e/m21-image-matte.spec.ts` asserts `mask-type="luminance"` for an inverted alpha image matte;
`e2e/m20-radial.spec.ts` asserts the inverted text is painted black). The export renderer had drifted
from that authority.

## 2. The measured root cause

A probe of five mask formulations in Chromium, sampling the same two points, decided the fix:

| Formulation | Inside source | Outside source |
|---|---|---|
| alpha mask + white backdrop + black source (**what was emitted**) | opaque | opaque |
| luminance mask + white backdrop + black source | **transparent** | **opaque** |
| alpha mask with a single evenodd hole path | transparent | opaque |
| alpha mask with the source painted white (the normal case) | opaque | transparent |

The luminance form is the only one that is both correct and general: the evenodd hole needs the
source geometry as a path, which text and image sources cannot provide, while the luminance form
works for every content type the renderer supports.

## 3. Applied

- **`src/ograf/svgRenderer.ts`** — an inverted matte now emits a **luminance** mask holding a white
  full-region backdrop and the source painted black; the mask declares the model it actually uses
  (`mask-type="luminance"`) while its id keeps naming the relationship (`...-alpha-inverted`).
- **The sibling branch had the same defect, found by the new pixel test.** The inverted *luminance*
  matte used an `feComponentTransfer` filter with no backdrop, so the mask had no luminance outside
  the source: measured inside `255`, outside `0` — transparent everywhere except the source, which is
  the inverse of correct. It now uses the same documented technique, and the filter branch is gone.
  Both inverted modes therefore share one construction.
- **`renderText` treats the caller's paint as an override.** The matte path paints the source black to
  punch the hole, but the text renderer emitted its own `fill` first and appended the caller's, so a
  browser used the layer colour and a dark text produced no hole (the editor paints its mask text
  black, and its spec asserts it). The override now replaces the layer's paint instead of being
  appended as a duplicate attribute — which also removes the invalid duplicate `fill`/`stroke`/
  `fill-opacity` attributes that path emitted.
- **`src/ograf/runtimeTemplate.ts`** mirrors all of it in the generated runtime, including a
  `fillOverride` argument on the generated `text()`, so the two renderers cannot drift apart.

## 4. Evidence

A new browser spec, `e2e/ograf-matte-visual.spec.ts`, rasterizes the real exported SVG in Chromium and
samples the alpha **inside the source** and **inside the target but outside the source**:

| Case | Before | After |
|---|---|---|
| inverted alpha | inside opaque, outside opaque (fail) | inside transparent, outside opaque |
| inverted luminance | inside opaque, outside transparent (fail) | inside transparent, outside opaque |
| generated runtime, inverted alpha | fail | matches the canonical renderer pixel for pixel |
| normal alpha (regression guard) | pass | pass |

`src/tests/ografGeneratedParity.test.ts` now pins the *definition* both renderers emit — the mask model
and the two paints — for the inverted case, and pins that a normal alpha matte still declares
`mask-type="alpha"` with no backdrop. The test that previously asserted `fill-rule="evenodd"` (a no-op
attribute on a single subpath) and the `fill="black"` string was replaced: it pinned the broken
construction rather than its result.

## 5. Validation

| Check | Result |
|---|---|
| `e2e/ograf-matte-visual.spec.ts` | PASS — 4 pixel cases (3 of them fail against the pre-fix code) |
| `npx vitest run src/tests/ografGeneratedParity.test.ts` | PASS — 9 tests |
| `npm test` | PASS — 125 files / 1,914 tests |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests, candidate `85c3929` |
| `npx playwright test e2e/ograf-matte-visual.spec.ts` | PASS — 4 tests |
| `npx playwright test e2e/track-matte.spec.ts` (the editor's own matte suite, 82 cases) | PASS — 82 tests in 4.8 min |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 6. Self-review (read-only, same model)

- **One construction for both inverted modes**, taken from the editor authority rather than invented,
  so the export matches what the editor shows.
- **The mask id is unchanged** (`...-alpha-inverted`, `...-luminance-inverted`), so references,
  diagnostics and any host that keys on the id keep working; only the mask's declared model changed,
  and the normal (non-inverted) path is byte-for-byte what it was.
- **Image sources** cannot be repainted, so the luminance mask reads the image's own luminance. That is
  exactly what the editor does for an inverted image matte (`e2e/m21-image-matte.spec.ts` asserts the
  luminance structure and "dark pixels hole"), so the two agree.
- **`renderText` blast radius.** Only the matte path passes paint, so ordinary text rendering takes the
  same branch it always did (the overrides are `undefined`).
- **Not changed:** the clip path, the layer-mask definitions, the luminance *non-inverted* matte, the
  matte relationship resolution, and the OGraf validation diagnostics.

## 7. Not changed

- No new dependency, workflow, tag or release action.
- No change to the OGraf package format, the public controls, or the editor's own matte renderer.
