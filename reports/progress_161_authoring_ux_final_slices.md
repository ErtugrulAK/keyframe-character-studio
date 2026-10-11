# Authoring UX final slices — progress 161

Task record for the final part of the authoring-UX orchestrator (2026-10-11): the colour
picker popover, the top authoring toolbar, the editor context menu, true layer grouping, the
aggregate group frame, and the validation / self-review / PR / preview / handoff work that
closes the line.

## 1. Identity

| Field | Value |
|---|---|
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-authoring-ux-final` |
| Branch | `fix/authoring-ux-final-slices` |
| Starting head | `4d78481` (base `origin/fix/authoring-ux-corner-anchor` @ `b453ba1`) |
| Application commits on top | `ebe3892` (fix: anchor a layer group's corner drag on the aggregate frame box), `e1af918` (test: measure the legacy stage gestures from the stage box), `be645b1` (test: cover authoring ux interaction collisions) |
| Docs commit | the handoff refresh on top of `be645b1` (documents only, no served file changes) |
| Stacked PR | [#7](https://github.com/ErtugrulAK/keyframe-character-studio/pull/7) — base `fix/authoring-ux-corner-anchor`, head `fix/authoring-ux-final-slices`, `MERGEABLE`, review and CI only |
| CI | `CI Pipeline` run `38162773244` (`pull_request`) — **success** on the validated head `be645b1`; the documentation commit on top re-runs the same workflow (documents only) |
| Preview | `http://localhost:5173/` — switched to this worktree after validation, self-review, push and green CI (see section 9) |
| API | `127.0.0.1:5000` — never stopped, never rebound (PID 24896, same process) |

## 2. Scope the orchestrator covered

Four authoring surfaces and one authoring model, each built on an authority the editor already
owned instead of a parallel one:

1. **Colour** — `ColorPickerPopover`: a swatch that opens ONE floating popover (saturation /
   value area, hue slider, alpha slider, RGBA fields, hex field) replacing the always-open
   inline panel. It owns display state only; every authored value travels through the caller's
   existing colour / alpha write path, and one completed pointer gesture is one batch
   interaction (one history entry).
2. **Toolbar** — `AuthoringToolbar`: a fixed 40 px docked strip carrying the canvas tools, the
   grid toggle, camera zoom / reset (dispatched on the established `canvas-viewport-command`
   channel), the shared paint swatches, the group actions and the Boolean actions. It owns no
   document state: view-only controls cannot write the project.
3. **Menu** — `EditorContextMenu` + `EditorContextMenuProvider`: the one right-click menu,
   shared by the stage and the outliner and openable from the keyboard (Shift+F10 / the
   context-menu key). Every item runs an existing authority (clipboard, deletion, reorder,
   selection, Boolean dissolve, grouping); items are built from the live selection.
4. **Groups** — a layer group is a real container layer (`CharacterPart.isGroup`) whose
   children point at it through the existing `parentId` relationship, so evaluation,
   save/load and OGraf export are unchanged. Group / ungroup re-express each child exactly in
   the container's space, and the group's selection frame is ONE aggregate box drawn from the
   live evaluated bounds of the layers inside it.

## 3. Phase-by-phase results

| # | Item | Result |
|---|---|---|
| 1 | `npm run build` | pass — `tsc -b` clean, `vite build` 2049 modules |
| 2 | `npm run validate:ograf` | pass — `fixtures/ograf/minimal.ograf.json: valid OGraf v1 manifest` |
| 3 | `CI=1 PORT=5005 npm run qa:release` | pass — 2 tests, "Release gate passed for candidate SHA" |
| 4 | `CI=1 PORT=5005 npm run qa:v6` | pass — 3 tests |
| 5 | `npm run check` | pass — oxlint clean, `tsc -b` clean, 145 files / 2219 tests, build |
| 6 | `node scripts/check-state-consistency.mjs` | pass — 42 checks |
| 7 | `npm audit --audit-level=low` | pass — 0 vulnerabilities |
| 8 | `git diff --check` | pass — no whitespace errors |
| 9 | Full Chromium `CI=1 PORT=5005 npx playwright test --retries=0` | pass — **334 passed / 0 failed / 0 flaky / 0 skipped** (includes the new 14-case collision spec) |
| 10 | Cross-feature interaction-collision pass | pass — `e2e/authoring-ux-interactions.spec.ts`, 14 focused real-browser cases (see section 6) |
| 11 | Same-model self-review of the whole diff from `b453ba1` | complete — findings and fixes in section 7 |
| 12 | Docs commit `test/docs: complete authoring ux validation and handoff` | this document and the regenerated one-file |
| 13 | Push (explicit refspec) + ONE stacked PR | pushed as `refs/heads/fix/authoring-ux-final-slices`; PR #7 created (single PR) |
| 14 | Integration readiness audit (no merge) | see section 10 |
| 15 | 5173 switch to the final line | see section 9 |
| 16 | Handoff refresh + consistency re-check | this document, the bundle refresh and the one-file regeneration |

### The first full-suite run was not green, and why

The first full Chromium run on `4d78481` reported 6 failures (314 passed). All six came from
three Phase 6.4 specs (`e2e/workflow.spec.ts`, `e2e/layer-index-persistence.spec.ts`,
`e2e/named-sequence-v2.spec.ts`) that performed stage gestures at **fixed** coordinates
(`box.y + 280`): the docked authoring strip owns 40 px of the layout, and the measured stage
box is 584 x 281 px, so those gestures landed on the timeline resizer and created nothing.
They now measure the gesture from the stage box. One of them also drew a freeform *inside* an
existing rectangle, which the renderer makes impossible for every tool — `PartRenderer`
consumes a mousedown that lands on a layer
(`src/components/Canvas/renderers/PartRenderer.tsx:105`, unchanged by this branch) — so that
case now stages the freeform first and surrounds it with the container, keeping its intent and
every assertion. No assertion, threshold or retry was weakened; `--retries=0` throughout.

## 4. Colour picker — contract and result

- One swatch per paint (`Fill`, `Stroke`, `FILL COLOR`, `STROKE COLOR`, text and effect
  paints); opening it writes nothing to the project.
- One floating popover per open swatch, portaled to the body, positioned by the shared
  floating-panel engine and clamped inside the viewport (including for the swatches at the
  bottom of the sidebar).
- Escape closes it and hands focus back to the swatch; an outside press on another control
  keeps that control's focus; a press on inert chrome restores the swatch. Tab leaves it.
- A completed pointer gesture is exactly one undo entry; undo / redo restore the authored
  colour exactly (verified in the real browser).
- Alpha is carried per paint (`fillOpacity` / `strokeOpacity`), the A channel and the alpha
  slider agree, and the authored alpha survives save / reload.

## 5. Toolbar and context menu — results

- The strip is a fixed 40 px, so mounting, unmounting or repopulating it never moves or
  rescales the authored world (measured <= 1 px in the real browser), and it is a `toolbar`
  with grouped, keyboard-operable controls.
- Tools and grid read / write the same animator state the floating viewport toolbar uses;
  zoom / reset travel on the existing `canvas-viewport-command` channel; a view-only gesture
  leaves the history exactly as deep as it was.
- The menu is the single right-click surface for the stage and the outliner. It selects (or
  keeps) the target before opening, keeps a multi-selection intact, offers only what can
  actually run (no disabled clutter on the empty stage), never opens the browser's native
  menu, stays inside the viewport, closes on Escape / Tab / an outside press, restores focus,
  and can be opened from the keyboard for the current selection. Its items run the existing
  authorities, so a menu action cannot bypass history or the action layer.

## 6. Cross-feature interaction coverage added by this task

`e2e/authoring-ux-interactions.spec.ts` (14 cases, all real Chromium):

1. the menu owns Escape — the armed shape tool keeps its authoring session and the next drag
   still creates the shape;
2. the paint popover keeps authoring through an Inspector collapse and reopen, and the
   Inspector's own swatch reads the same authored value;
3. the menu opens on the pointer after a zoom and a pan, stays inside the viewport, and the
   authored world does not move;
4. a group container is never offered as a Boolean operand (with a positive control);
5. an empty document offers no grouping, paint or menu surface;
6. the aggregate frame resizes the whole group around the fixed opposite corner (<= 1 px),
   keeps the layers' own local poses, never flips the container's scale sign, and one undo
   restores the exact document;
7. the toolbar's Pan tool pans without writing the document, and Select restores handle
   resizing through the same frame;
8. grouping inside a parent keeps every parent-space pose and ungroups exactly;
9. bonded layers keep their bond and move together through grouping;
10. mirrored (negative scale) layers group and ungroup without changing their rendered pose;
11. grouping folds the keyframes of **every** sequence by the same container delta, keeps
    every keyframe time, preserves the pose of a different active sequence at the same frame,
    and ungroups back to a byte-identical document;
12. ungroup refuses an animated container with the documented reason and writes nothing;
13. colour, group and duplicate are one history entry each, and undo / redo walk exactly
    through those states;
14. a group and an authored colour survive a reload, and ungroup still works afterwards.

## 7. Self-review findings (whole diff from `b453ba1`)

Fixed:

- **Group corner drag anchored on the wrong box (product fix, `ebe3892`).** A group container
  owns no geometry, so the frame is drawn from the group's aggregate box while the corner drag
  solved against the container's own (meaningless) local bounds. Measured: the opposite corner
  drifted ~48 px and the container's scale crossed zero (`scaleX: -0.31`). The gizmo now hands
  the drag the box it drew (`overrideBounds`), with a unit guard in
  `src/tests/selectionGizmo.test.tsx` and the E2E anchor assertion in case 6.
- **Legacy stage gestures (`e1af918`).** Three specs used fixed stage coordinates the docked
  strip pushed onto the timeline; see section 3.

Reviewed, deliberately unchanged (recorded as facts, not defects introduced here):

- **Menu / popover keyboard leakage.** The menu owns Escape (React's portal listener stops the
  native propagation before the window-level shortcut authority sees it — case 1 proves it).
  Every other key behaves exactly like the editor's other non-modal surfaces, which is the
  documented contract in `src/utils/modalBoundary.ts`; no new leakage was introduced.
- **The frame handles stay interactive under the Pan tool.** `startScale` / `startRotate`
  check only `appMode` and the button, so grabbing a handle with Pan selected still resizes.
  This is pre-existing (the same code and behaviour on the base) and changing it is an
  app-wide interaction decision, so it is reported rather than changed. Covered instead: the
  toolbar's Pan gesture never writes the document and Select restores handle resizing.
- **A mousedown on a layer belongs to the layer for every tool** (so a freeform draw or a pan
  cannot start over artwork). Pre-existing renderer behaviour, reported above.
- Duplicate: a group duplicate re-parents every clone to the cloned container, a non-group
  duplicate keeps its group membership, clones drop `boundPartIds` (unchanged semantics) and
  take fresh ids and z-indexes.
- Persistence: the container is saved with `isGroup`, `visible: false` and `opacity: 0`. The
  editor paints from the evaluated layer (not that flag), so the edit-mode picture is
  unchanged; the OGraf renderer skips a geometryless, zero-opacity layer (unit-tested), and a
  save / reload round trip is covered end to end (case 14).
- Deletion / orphaning: deleting a group deletes the layers it owns; group / ungroup round
  trips are byte-identical for exact geometry (cases 8, 10, 11).
- Keyframes: the fold rewrites every sequence's keyframes by the same constant (needed for
  exactness in every sequence) and never changes a keyframe time or easing.
- Layout / a11y: no new transitions or animations (no reduced-motion risk), both floating
  surfaces share z-index 1200 and cannot coexist (an outside press closes the popover first),
  the strip scrolls horizontally at a fixed height, and no new dependency, secret, debug log
  or test artefact entered the tree (the Playwright report directories are gitignored).

## 8. Full validation counts (final tree)

- oxlint clean; `tsc -b` clean; vitest **145 files / 2219 tests**; `vite build` pass.
- OGraf manifest validation pass; release gate 2 tests pass; V6 QA 3 tests pass.
- Full Chromium with `--retries=0`: **334 passed / 0 failed / 0 flaky / 0 skipped**.
- `npm audit --audit-level=low`: 0 vulnerabilities; `git diff --check` clean.
- `node scripts/check-state-consistency.mjs`: pass (42 checks) after the bundle refresh.

## 9. Preview and isolation

Before the switch, 5173 was the **corner-anchor** worktree's dev server (PID 34208,
`...\keyframe-character-studio-omp-corner-anchor\node_modules\.bin\..\vite\bin\vite.js --host
--port 5173`). That single process was stopped — the API was not touched — and the preview was
started from this worktree with `npx vite --host --port 5173` (never `npm run dev`).

| Check | Result |
|---|---|
| 5173 before | PID 34208, vite from `keyframe-character-studio-omp-corner-anchor` |
| Stopped | PID 34208 only; nothing else was signalled |
| 5173 after | PID 34956 (harness service `kcs-ui-5173-final`), `...\keyframe-character-studio-omp-authoring-ux-final\node_modules\.bin\..\vite\bin\vite.js --host --port 5173` |
| 5173 HTTP | `200` |
| Branch served | `fix/authoring-ux-final-slices` |
| Served SHA | `be645b1` (the validated head at switch time; the documentation commit that follows changes documents only and no served file) |
| 5000 HTTP | `200` at `/api/health` (`{"status":"online","service":"Keyframe Studio API",...}`) |
| 5000 PID | `24896` — the same process as before this task; never stopped, rebound or restarted |
| Stable repository | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` — `main` @ `c46e698`, working tree clean, untouched |

Every test in this task used the isolated pair: `CI=1 PORT=5005` → UI 5188 / API 5005 (the
release gate used 5189 and the V6 QA gate 5187); ports 5173 and 5000 were never bound by the
test tooling, and `playwright.config.ts` was not edited.

## 10. Integration readiness (audit only — nothing was merged)

| PR | Base | Head (tip) | Validated application head | Mergeable / state | Current-head CI |
|---|---|---|---|---|---|
| [#4](https://github.com/ErtugrulAK/keyframe-character-studio/pull/4) | `main` | `fix/authoring-ux-transform-toolbar` @ `7d7ebe2` (docs tip) | `f13fed0` | `MERGEABLE` / `CLEAN` | run `38144053475` — success on `7d7ebe2` |
| [#5](https://github.com/ErtugrulAK/keyframe-character-studio/pull/5) | `fix/authoring-ux-transform-toolbar` | `fix/authoring-ux-camera-invariance` @ `55a4ab2` (docs tip) | `73dccbb` | `MERGEABLE` / `CLEAN` | run `38146416150` — success on `55a4ab2` |
| [#6](https://github.com/ErtugrulAK/keyframe-character-studio/pull/6) | `fix/authoring-ux-camera-invariance` | `fix/authoring-ux-corner-anchor` @ `b453ba1` (docs tip) | `04dc182` | `MERGEABLE` / `CLEAN` | run `38150088623` — success on `b453ba1` |
| [#7](https://github.com/ErtugrulAK/keyframe-character-studio/pull/7) | `fix/authoring-ux-corner-anchor` | `fix/authoring-ux-final-slices` @ `be645b1` (+ this docs commit) | `be645b1` | `MERGEABLE` / `CLEAN` | run `38162773244` — success on `be645b1` |
| [#3](https://github.com/ErtugrulAK/keyframe-character-studio/pull/3) — **audited separately** | `main` | `fix/ograf-runtime-parity-phase-a` @ `f53398f` (docs tip) | `e5a2b8a` | `MERGEABLE` / `CLEAN` | run `37938681434` — success on `f53398f` |

Facts this audit establishes:

- **The stack is contiguous.** Each base branch's tip is exactly the previous PR's head
  (`7d7ebe2` = #5's base, `55a4ab2` = #6's base, `b453ba1` = #7's base), so merging #4 and then
  letting GitHub retarget #5 to `main`, #5 → #6, #6 → #7 is a base-pointer fast-forward that
  cannot drop a commit. Every head is an ancestor of the next head.
- **No branch has drifted.** Each PR's head SHA equals its branch tip and its latest CI run's
  head SHA; no base pointer was moved by this task.
- **A docs-only tip hides the validated application SHA on four branches** (#3, #4, #5, #6 —
  each tip is a `docs:` commit). The application heads to smoke if these are ever released are
  the ones in the table, not the tips. #7 follows the same convention after this handoff
  commit: its validated application + test head is `be645b1`, with the documentation commit on
  top.
- **Runtime parity (#3) is a different line** and must not be folded into this stack; it was
  audited on its own above.

Recommended order: **#4 → #5 → #6 → #7**, retargeting each as its base lands, then decide about
#3 independently. Expected conflicts are confined to the shared documents (`docs/`,
`chatgpt_handoff/`), where each branch appends its own section — keep both sides.

After real integration to `main`, any release-candidate or stable decision needs a **fresh
exact-SHA release smoke on the new `main` SHA**: the validation recorded here is bound to the
branch heads, not to the merged result.

## 11. Known group limitations (recorded, deliberately not fixed here)

1. Ungroup refuses while the **group itself** is keyframed.
2. Ungroup refuses a **rotated** group whose children carry keyframed transforms; static
   children, and any translation- or scale-only group, are exact.
3. Grouping **animated** layers inside a **rotated parent** is refused.
4. Grouping refuses Boolean operands and layers that use a stage anchor preset.
5. No canvas body-drag surface was added for a selected group: the decorative frame is
   `pointer-events: none` and adds no hitbox.

Bind / Bond semantics were not changed and were not aliased.

## 12. Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. That one file carries this record,
the bundle README, the manifest, the next-session note, the project state, the release
summary, the grouped roadmap, every progress document and the changelog. No other file needs
to be uploaded, and nothing outside `chatgpt_handoff/` was modified for this handoff.
