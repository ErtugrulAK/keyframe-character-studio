# C2 — Interaction reliability and professional editor UX: final report

Session: 2026-10-22. Worktree `C:\Users\ertugrul.ak\Desktop\kcs-master-implementation`, branch
`feature/motion/kcs-master-implementation`, HEAD `39f6414` (unchanged — nothing committed, staged,
merged or pushed). WP-01–07 changes are kept; C2 is layered on top of them.

Reports of this continuation: `00_C2_BASELINE_AND_SLICES_A_TO_D.md` (A–D),
`01_C2_SLICES_D_TO_G.md` (perf, layer tree, keyboard/toolbar/right-click, mode transition),
`02_UI_LIBRARY_EVALUATION.md` (§14), this file (H, acceptance, status). Reports 00–08 and earlier
evidence were not modified.

## H — Late findings fixed during the final regression and acceptance

| Finding | Reproduction | Root cause | Fix | Risk |
|---|---|---|---|---|
| Corner resize of a just-created rectangle did nothing | `canvas-interaction-v1.spec.ts:95` (passes on base) | C2 tool ownership: the still-armed Rectangle tool (existing "retire the gesture, not the tool" contract) also captured presses on the new shape's transform handles | the armed shape tool treats the selection's transform gizmo as stage chrome | low; drawing that starts exactly on a handle now resizes instead (as on base) |
| Dock handle focus ring test | `panel-edge-handles.spec.ts:240` | layer-tree rows are now focusable (roving tabindex); the test's mouse click left the browser in pointer modality, so programmatic focus did not match `:focus-visible` | test now establishes keyboard modality (Shift) before focusing — the assertion (≥ 2 px ring) is unchanged | none in product |
| 200 % zoom / short window: stage ~30 px tall, artboard 22×16 px | acceptance `zoom200-equivalent` (720×450 CSS px @2x) | the timeline height ceiling was applied on window `resize` only, never to the window the editor opens in; the opening camera was fitted to that crushed box | same clamp also runs once at mount; when it changed the layout, a new `refit-untouched-camera` command re-fits ONLY an untouched opening camera (zoom 1, never panned) | camera area (high-risk): a user camera is never touched; covered by the camera E2E specs in the full run |
| Pen clicks lost / drawing finished early on a small stage | same variant | the drawing banner wrapped into a ~130×130 px block over the drawing area; its text swallowed clicks and its Finish button sat where the user draws | drawing banners pass the pointer through except their buttons; a container query keeps every stage banner to one compact line on a stage ≤ 560 px (status text visually hidden ≤ 300 px, still announced) | CSS only; `container-type: inline-size` does not change the stage box |
| WP-07 regression found by the full Vitest run | `ografBrowserZip.test.tsx` (2 tests) pinned the Export menu to 3 items | WP-07 added the read-only "Check OGraf Export…" item | test now pins the exact 4 labels and the disabled state of all 4 (stricter, not looser) | none |
| GIF "Save and reload" test (§16) | `gif-export.spec.ts` A1 | the seed `addInitScript` ran again on the editor's own reload and re-wrote the original scene over the save under test | one-time seed per tab (sessionStorage guard) + waits for the real `load` event; FPS/persistence assertions unchanged | none; 8/8 repeated passes |

Tests updated because the product contract intentionally changed (assertions kept or tightened):
`wp05-layer-ordinal` (a reorder drop now targets the row's lower edge — the middle nests),
`m22-matte-relationship` E2E-2/E2E-8 and `wp04MatteNavigation` (a matte-source delete now confirms
the named dependent first), `keyboard-shortcuts` (42 rows, new Layer list band),
`shortcuts.test.ts` (conflict audit extended to every scope + pinned local overrides).

## Acceptance scenario (§17)

`qa/evidence/c2-acceptance.evidence.ts`, screenshots + `acceptance-log.txt` per variant in
`evidence/c2-acceptance/{desktop-1440,narrow-1024,zoom200-equivalent}/`. All three variants PASS.

| # | Step | How it is proven |
|---|---|---|
| 1 | Image covering the canvas | fixture (seeded image 1920×1080; the media picker is a file upload outside the scenario) |
| 2 | Rectangle over the image | real drag with the armed tool; saved scene has the new rect; it (not the image) is the selection |
| 3 | Pen, multi-point, Undo/Redo before commit | 5 clicks → Ctrl+Z → 4 → Ctrl+Shift+Z → 5 draft points |
| 4 | Finish with the mouse, Select active | click on the first point; `Select` is `aria-pressed` |
| 5 | Mask on the image, closed near its start | 4 Mask Pen clicks, close click 4–5 px off the first point; persisted path has 4 points |
| 6 | Corner → Smooth, owner fixed | Inspector radio; persisted point kind `smooth`; owner x/y/rotation/scale identical; `]` selects the next point |
| 7 | Layer and group rename | group by double-click, layer by F2; both persisted |
| 8 | Square → Triangle → Star; Circle independent | drag-nest + Alt+→; every on-screen centre within 0.75 px; Circle parent empty |
| 9 | Parent and child transforms separately | Square +80 moves Square/Triangle/Star; Star −40 moves only Star; Circle 0 px |
| 10 | Repeated show/hide, no camera jump | 4 layer-eye toggles + 4 rounds of Inspector/left toolbar/timeline toggles; artboard drift < 0.5 px |
| 11 | Scrub/playback measured | UI frame interval p95 (scene of 8 layers): see `acceptance-log.txt` (16.7–33.3 ms); heavy-scene numbers in `01_…` §D |
| 12 | Edit ⇄ Broadcast keeps state | selection and playhead identical after the round trip |
| 13 | Undo/Redo + save/reload | layers identical after Undo+Redo; after reload: hierarchy, names, mask point type, group child kept |
| + | Shortcut reference at this viewport | fits without horizontal scroll, filter "nest" → 1 row, Tab stays inside, Esc closes |

"200 %" is the layout-equivalent viewport (720×450 CSS px at DPR 2 = a 1440×900 window at 200 %
browser zoom). Headless Chromium has no browser zoom UI and the in-app browser does not accept
page-zoom keys, so a REAL Ctrl+= zoom was not exercised: listed as not verified.

## Validation on the final code

| Command (cwd: worktree) | Result | Log |
|---|---|---|
| `npx vitest run` | 212 files, 3 061 tests passed | `logs/c2_vitest_full.log` |
| `npx tsc -b` | exit 0 | `logs/c2_tsc.log` |
| `npm run lint` | exit 0; 1 pre-existing warning in untouched `k5MatteVisibility.test.tsx` | `logs/c2_lint.log` |
| `npm run build` | exit 0 (pre-existing INEFFECTIVE_DYNAMIC_IMPORT notice, also in WP-03 log) | `logs/c2_build.log` |
| `npx playwright test -c reports/kcs-master-implementation/qa/playwright.isolated.config.ts --project=e2e` | 503 tests: 501 passed, 2 failed (21.8 min). Both fixed and re-verified: `track-matte` V-G13 (WP-05 ordinal leaked into the tree row's accessible name — ordinal is now `aria-hidden`, position via `aria-posinset`) and `wp04-matte-navigation` (delete now confirms the named dependent — test confirms the dialog). Rerun `track-matte wp04-matte-navigation wp05-layer-ordinal c2-layer-tree m22-matte-relationship`: 98/98 passed; full Vitest after the fix: 3 061 passed | `logs/c2_e2e_full.log` |
| acceptance (3 variants) | 3 passed | `evidence/c2-acceptance/` |
| perf probe / attribution | see `01_…` §D | `evidence/c2-perf/` |

## Status

| Slice | IMPLEMENTED | TESTED | BROWSER VERIFIED | USER ACCEPTED | MERGED |
|---|---|---|---|---|---|
| A/B tool ownership + draft Undo/Redo | YES | YES (unit + E2E) | YES (Playwright Chromium; in-app browser earlier) | PENDING | NO |
| C mask path editing ergonomics | YES | YES | YES | PENDING | NO |
| D show/hide anchor + performance | YES | YES (before/after measured) | YES | PENDING | NO |
| E layer tree, rename, parenting, delete dependents | YES | YES | YES | PENDING | NO |
| F keyboard, shortcut reference, toolbar hints, right-click | YES | YES | YES (real 200 % zoom: NOT verified, equivalent viewport only) | PENDING | NO |
| G Edit ⇄ Broadcast | YES | YES | YES | PENDING | NO |
| H late fixes + GIF test + acceptance | YES | YES | YES | PENDING | NO |
| §14 UI library evaluation | EVALUATED (nothing installed) | n/a | n/a | PENDING | NO |

## Answers

- **What really improved?** Drawing over images works and owns the pointer; an open drawing owns
  Undo/Redo; drawings finish by clicking the first point or a visible button; mask points close
  reliably at any zoom and show/change Corner/Smooth; the stage backdrop no longer slides on panel
  toggles; the layer tree renames (incl. groups), parents with pose preservation and explains every
  refusal; a matte-source delete names its dependents; right-drag pans without a stray menu; Broadcast
  round trips keep the tree state; dock toggles and playback re-render less (measured);
  short/200 %-zoomed windows open with a usable stage and drawable banners.
- **Which user tasks are proven?** The 13 acceptance steps in three viewport variants, plus the
  per-slice E2E specs listed in reports 00/01.
- **Still missing or blocked:** real browser-zoom (Ctrl+=) check; Inspector card disclosure is not
  retained across Broadcast; deleting a NON-group parent leaves children with a dangling parent
  (pre-existing delete contract, now easier to reach); animated reparenting is refused rather than
  re-based (by design of this pass); header wraps to two rows at ≤ 720 px CSS width (not changed);
  playback cadence on the 150-layer scene is bounded by stage rendering (`PartRenderer`), untouched.
- **How to try it:** in a PowerShell window:
  `cd C:\Users\ertugrul.ak\Desktop\kcs-master-implementation` then
  `npx vite --host 127.0.0.1 --port 5198 --strictPort`, open http://127.0.0.1:5198 (a fresh origin:
  your normal editor's saved scene is not there).
- **Main and Sprint 1 protected?** Yes: HEAD, status, tracked-diff hash and every untracked file's
  SHA-256 are identical to the snapshot taken at the start of C2 (re-checked at the end).
