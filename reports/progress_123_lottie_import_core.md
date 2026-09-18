# Progress 123 — Lottie Import Core, First Slice (Milestone F, item 10)

## 1. Scope

The approved first slice of `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`: the import **core**. It maps a Lottie document into a normal KCS `SceneData` plus a loss report, covering document timing, shape/solid/null layers, transforms, paths, primitives, fill/stroke/trim and the temporal/easing rules. Everything the slice does not convert is **reported**, never guessed. There is deliberately **no UI entry point** yet: the caller receives a scene it can hand to the existing import path.

## 2. Branch

- `feat/lottie-import-core`, based on `main` at `06a5dfcf98cf7d5a0dd61f09ca06acab35dcd26e` (after the CI hotfix).

## 3. What changed

- **`src/interop/lottie/temporal.ts`** — the conversion that must not be guessed:
  - `frame = max(0, round(t − documentInPoint − layerStartTime))`; the importer preserves the document frame rate, so Lottie frame units and scene frames are the same unit (documented in the module).
  - **The segment split:** Lottie's `o` on keyframe *k* is the outgoing control point of the segment *k → k+1* and its `i` is the incoming control point of that same segment, so `mapped[k].bezierOut ← o` and `mapped[k+1].bezierIn ← i`. A converted channel therefore keeps both sides of every curve.
  - `h: 1` → the `hold` easing with no invented handles; a segment without handles → `linear`; a **roving** keyframe or an **expression** keyframe is reported (`LOTTIE_ROVING_KEYFRAME`, `LOTTIE_UNSUPPORTED_EXPRESSION`) and falls back to linear.
  - The per-channel keyframe limit (512) reports `LOTTIE_KEYFRAME_LIMIT` and keeps the first keyframes.
- **`src/interop/lottie/diagnostics.ts`** — the loss-report contract: a stable code, severity, feature, source document path, message and a mandatory action, plus the first-cut limits that this slice enforces (512 keyframes per channel, 32 hierarchy levels, 4096 vertices, 32 MB document). The mask limit from the design arrives with the mask slice, because nothing converts masks yet.
- **`src/interop/lottie/mapDocument.ts`** — `importLottieDocument(text)` → `{ ok, scene?, diagnostics }`:
  - Untrusted-input handling like the project import boundary: size limit before parsing, JSON syntax, and a depth-bounded prototype-key walk reusing `isPrototypeSensitiveKey`.
  - Document level: `fr` → `fps` (fractional rates rounded and reported), `ip`/`op` → `totalFrames` with an in-point shift warning, `w`/`h` → scene size, `nm` → name, and the scene is emitted as `coordinateSystem: 'project-unit-center-v1'`.
  - Layers: `ty` 1/3/4 (solid/null/shape) are converted; **precomps, text and images are reported and skipped** per the approved first-cut decision, as are effects, expressions, masks and track mattes; a parent index that is not an already-imported layer reports `LOTTIE_BROKEN_PARENT` and is dropped.
  - Transforms: `ks.p` (x/y), `ks.r`, `ks.s` (percent → factor), `ks.o` (percent → 0..1), static values as the base transform and keyframed ones as canonical channels.
  - Shapes: `sh` → `BezierPath` (v1) with a vertex limit, `rc`/`el` → width/height (plus `rc.r` → corner radius), `fl` → fill colour + opacity, `st` → stroke width + colour + opacity, `tm` → trim start/end/offset, `gr` → flattened and reported, anything else reported.
- **`src/tests/lottieImport.test.ts`** — **33 cases** across five groups: document timing (mapping, fractional fps, in-point shift, missing timing), transforms (static values, the segment split, hold, roving fallback, keyframe limit), dimensions and fallbacks (per-dimension vector mapping, non-uniform keyframed scale, roving *with* handles, a two-segment curve pinning both handles on the middle keyframe, layer start-time subtraction with the frame-0 clamp, hierarchy limit, layer in/out + skew + auto-orient reports, unreadable shape payloads, stroke colour), shapes and unsupported constructs, and untrusted input (malformed JSON, prototype key, size limit, broken parent).

**Bugs the tests caught while writing them** (each fixed before commit):

1. The incoming handle was attached to the keyframe that *holds* it instead of the keyframe it *arrives at*.
2. Rectangle size and fill colour were read through a record helper that rejects arrays, so `{ k: [x, y] }` produced nothing.
3. **Review round 1 (independent, read-only) found three more, all fixed here:**
   - A vector property aliased its first component into every channel: `p: [15, 25]` imported `y = 15` and non-uniform `s: [100, 200]` imported `scaleY = 100`. Numeric properties now keep every dimension and each channel maps its own.
   - A roving or expression-driven keyframe **with** handles kept its Bezier easing; the design requires the linear fallback plus a report, so both handle passes now skip such a segment.
   - The `y` channel's diagnostics were dropped from the report (they are distinct paths), and keyframed scale/opacity carried Lottie percentages while the static base values were divided by 100 — the channels now go through the same conversion.

**Review round 1 also asked for fuller reporting, now added:** layer in/out ranges, skew, auto-orient, the document 3D flag, unreadable shape payloads, stroke colour mapping, and the hierarchy limit measured as a chain depth instead of an index gap (the unused mask limit was removed).

**Review round 2** went further on the design's "lossless" rows and the silent drops behind them, and this revision adds:

- Solid layers now map their own paint and size (`sc` → fill colour, `sw`/`sh` → width/height) instead of importing a white layer.
- A rect corner radius maps to `borderRadius`, and stroke opacity maps to `strokeOpacity` (percent → factor).
- The constructs KCS genuinely does not model are **reported** rather than ignored: the layer anchor (`LOTTIE_UNSUPPORTED_ANCHOR`), a shape's own position (`LOTTIE_UNSUPPORTED_SHAPE_POSITION`), stroke cap/join (`LOTTIE_UNSUPPORTED_STROKE_STYLE`, and only when the value differs from Lottie's default), and **one** `LOTTIE_UNSUPPORTED_ANIMATED_SHAPE` entry per animated shape item, naming the animated properties (fill colour/opacity, stroke width/colour/opacity, rect corner radius/size, ellipse size, trim start/end/offset).

**Review round 3** found the animated-property detector reporting *static* fills as animated and three animated properties (trim offset, fill/stroke opacity, rect corner radius) still dropped without a note. The detector now decides by keyframe structure (a `k` whose first entry is an object with a numeric `t`), the per-type property list covers those three, and each item reports at most once. layer in/out ranges (`LOTTIE_LAYER_TIMING`), skew (`LOTTIE_UNSUPPORTED_SKEW`), auto-orient (`LOTTIE_UNSUPPORTED_AUTO_ORIENT`), the document 3D flag (`LOTTIE_UNSUPPORTED_3D`), unreadable shape payloads (`LOTTIE_UNREADABLE_SHAPE`, `LOTTIE_UNREADABLE_SIZE`, `LOTTIE_UNREADABLE_COLOUR`, `LOTTIE_UNREADABLE_STROKE_WIDTH`, `LOTTIE_UNREADABLE_PATH`), stroke colour mapping, the hierarchy limit now measured as a chain depth instead of an index gap, and the unused mask limit removed (it returns with the mask slice).

## 4. Validation (branch `feat/lottie-import-core`)

| Check | Command | Result |
|---|---|---|
| Type gate (CI's) | `npm run build` (`tsc -b && vite build`) | PASS |
| Lottie core suite | `npx vitest run src/tests/lottieImport.test.ts` | PASS — 33 cases |
| Full suite | `npm test` | PASS — 120 files / 1,769 tests |
| Lint | `npm run lint` | clean |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| State consistency | `node scripts/check-state-consistency.mjs` | PASS |

## 5. Protected invariants

- No UI, export, dependency, `package.json`, lockfile or workflow change; the importer only *reads* text and returns a scene, so no existing surface can be affected until a later slice wires an entry point.
- The canonical model, the OGraf package format and the export paths are untouched; the produced scene uses the existing `SceneData`/`AnimationTrackData` shapes, so the existing serializer validates it again.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 6. Residual risks

- **Not wired to a UI yet.** The importer is a library call; the design's "show the report before replacing work" step lands when an entry point is added, and importing today would require calling the module directly.
- **Colour/model limits of the first slice:** shapes are flattened (group transforms reported), masks and track mattes are reported rather than converted, and gradient/merge/repeater items are reported. Each is a documented follow-up slice.
- **Coordinate assumption:** Lottie units map 1:1 into `project-unit-center-v1`; a scene authored at a different scale needs the existing coordinate migration after import, which is not automatic.

## 7. Next slices (each needs its own approval)

1. Masks and track mattes (`§5` of the design).
2. Text and image layers, precomp flattening.
3. The import entry point with the report-before-replace UX.
