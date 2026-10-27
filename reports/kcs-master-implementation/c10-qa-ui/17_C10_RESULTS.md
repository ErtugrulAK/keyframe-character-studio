# C10 — manual QA round 2: removals, fixes, decisions, first features

Worktree `kcs-master-implementation`, branch `feature/motion/kcs-master-implementation` (no upstream).
Start `59fff26` (C8 report). Commits only on this branch; main untouched. Nothing merged or pushed.
USER ACCEPTED: **PENDING** (yours).

Input: the user's results for the C8 guide plus free-form notes. Decisions taken with the user:
mask MODE → one "Cut a hole" box; strokes scale with zoom and layer scale; the stopwatch goes ("+"
arms); an FPS change keeps time. Not done here by request: colour/glow restyling (an Astra prompt).

## 1. What changed

| Report | Root cause / decision | Change | Commit |
|---|---|---|---|
| 44, 64–66 IN/OUT presets | User: "remove it for now" | C9 restore reverted; preset data in scenes untouched | `bbd0b17` |
| 45 Duplicate card | User: the toolbar is enough | DUPLICATE card removed (Ctrl+D, context menu and Flip remain) | `d0bb0ec` |
| 49 star does not shape the photo | MEASURED/SOURCE: a new Track Matte kept `sourceVisible: true`, so the star painted itself on top | A NEW matte hides its source (AE behaviour); "Show source" turns it on; changing the source of an existing matte keeps its setting | `aa22702`, `0e30325` |
| 49.5 pick-whip, 50 caption | User: not needed | Pick-whip removed (the list asks the same validator and says why it refuses); Select Source shows only "Back to …" | `aa22702` |
| 47.4 C does not work | SOURCE: C was handled only while a point had KEYBOARD focus; a mouse click selects without focusing | C acts on the selected point; double-click toggles; Alt-drag a handle moves it alone; Alt-drag a point pulls out handles (masks and freeform paths, one helper set) | `96c2b92` |
| 48 + mask card notes | User: remove / simplify | Removed Add mask, Lock path (a saved lock still protects and shows "Unlock"), PATH ±15°/90/110 %, Enabled box (eye stays), Cuts layer box, Expand/Collapse, POINT TYPE, POINT ORDER; MODE → "Cut a hole" (Intersect/Difference in old files still render and are named) | `e8a57ce`, `7cd704a` |
| "0.1 cannot be typed" | REPRODUCED: raw controlled number inputs wrote `Number(text)` per key ("" → 0, "0." → 0); the e2e fails on the old input | `NumberField` keeps the typed text; used by mask, gradient, colour picker, curve, value-graph, sequence duration (commit on Enter) and resolution fields | `1f32161` |
| Anchor / X-Y letters | MEASURED (screenshot): X, Y, arrowheads and "0,0" sat at the stage centre over the artwork | Letters/arrowheads at the artboard edges, no caption | `27950b2` |
| 56 stopwatch confusing | Decision: remove | No stopwatch; an unanimated property's "+" arms it; right-click → "Remove all keyframes" (same confirmation, one undo) | `4b80bc9`, `6e80c2b` |
| Thick borders; 42 CENTER/OUTSIDE | MEASURED: at 100 % all three alignments were already correct; the stroke was `non-scaling-stroke`, so zooming out / scaling down left a 10-unit border at 10 screen px | Authored strokes scale with layer and view in the editor and the OGraf runtime (the static OGraf renderer already did) | `72252d9` |
| 14 FPS | Decision: keep time | `retimeDocumentForFps` rescales keys (all stores), sequence lengths, playhead, IN/OUT durations, text stagger start; colliding keys merge (reported); one undo | `7727278` |
| Feature: keyframe spacing | AE Alt-drag | Alt-drag the first/last key of a multi-frame selection stretches time about the other end (refuses crossing, out of range, stacking, landing on other keys); one undo | `35d3926` |
| Feature: animation code | First slice | Motion Curves takes pasted easing code (CSS cubic-bezier, array, 4 numbers, CSS keywords); it already copied CSS | `8059aee` |
| 2 narrow window | The user asked me to check | 1024 and 768 px: no horizontal scroll; "Align and distribute" / "Arrange and rotate" menus present (enabled with 2+ layers) | — |

Intermediate-commit note: `0e30325` already contains the masks card's `NumberField` usages; the
component arrives in the next commit `1f32161`. Only that one commit does not build on its own.

## 2. Open / proposals

- **200 % zoom (#3).** At 1440×900 @200 % (720×450 CSS px) the docks and timeline collapse and there
  is no page scroll. What still feels wrong needs the user's description or a screenshot.
- **FPS and project-template tabs.** The rate is project-wide, but each tab stores its own scene;
  only the open tab is retimed (adding a tab already resets the rate to 60).
- **Whole-animation code export (proposal).** "Copy animation as code" on the Animation Data card,
  in two formats from the evaluated channels of the selected layer:
  1. CSS `@keyframes` (percent stops per key frame union, `transform: translate() rotate() scale()`,
     `opacity`, per-segment `animation-timing-function: cubic-bezier(...)`), duration from the
     sequence and FPS;
  2. Web Animations API JSON (`element.animate([...], { duration, easing })`).
  Questions before building: coordinate origin (KCS is centre-origin, Y up in the Inspector),
  units (project px vs CSS px), and whether presets/masks/trim are in scope (proposed: no).
- **Colours / glow** are for the Astra prompt, untouched here.

## 3. Validation (HEAD `7cd704a`)

| Gate | Result | Log |
|---|---|---|
| `npx tsc -b` | exit 0 | `logs/c10_tsc.log` |
| `npm run lint` | exit 0; the same 3 pre-existing warnings as C8 | `logs/c10_lint.log` |
| `npm run build` | exit 0 | `logs/c10_build.log` |
| `npx vitest run` | 234 files, 3 219 tests passed | `logs/c10_vitest_full.log` |
| full E2E run 1 (`8059aee`) | 612 passed, 1 failed (a spec still pressing the removed order button → `7cd704a`) | `logs/c10_e2e_full.log` |
| full E2E run 2 (`7cd704a`) | **613 passed, 0 failed** | `logs/c10_e2e_full_2.log` |

Changed test expectations are for intended behaviour changes only (removed controls, hidden matte
source, scaled strokes measured in authored units, "+" arming, no stopwatch). Each new behaviour
has its own test; the number-field e2e was run against the old input and fails there (the stretch e2e would duplicate instead on the old code — reasoned, not run).

## 4. QA candidate

`.qa-artifacts/qa-20261026-1853-7cd704a/` — production build of the committed `7cd704a` tree;
smoke-tested on a temporary 5320 (header present, source and parent paths 404), since stopped.
5310 still serves `qa-20261026-1212-15ebda8` until the user approves the switch.

Test guide: `.research/qa/KCS_C10_Test_Rehberi.txt`.
