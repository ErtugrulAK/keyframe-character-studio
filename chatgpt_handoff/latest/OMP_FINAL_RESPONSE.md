# KCS — Authoring UX final slices: validation, self-review, PR and preview switch

## Latest action

The authoring-UX line is closed. Its final part validated the whole slice in the isolated
harness, ran a same-model review of the entire diff from the previous base, fixed the two
defects that review found, added a 14-case cross-feature interaction suite, pushed the branch
and opened **one** stacked pull request (#7) for review and CI only, then moved the live
`localhost:5173` preview onto this worktree. Nothing was merged, rebased, force-pushed, tagged
or released; the API on `5000` and the stable repository were not touched.

| Field | Value |
|---|---|
| Branch | `fix/authoring-ux-final-slices` (stacked on `fix/authoring-ux-corner-anchor` @ `b453ba1`) |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-authoring-ux-final` |
| Validated head | `be645b1` (commits `ebe3892` fix, `e1af918` test, `be645b1` test) |
| Docs commit | the handoff refresh on top of `be645b1` (documents only) |
| Stacked PR | [#7](https://github.com/ErtugrulAK/keyframe-character-studio/pull/7) — base `fix/authoring-ux-corner-anchor`, `MERGEABLE`, review and CI only, not merged |
| PR CI | `CI Pipeline` run `38162773244` — **success** on `be645b1` |
| Live preview | `http://localhost:5173/` — this worktree (PID 34956), branch `fix/authoring-ux-final-slices`, served SHA `be645b1`; the corner worktree's vite (PID 34208) was the only process stopped |
| API | `127.0.0.1:5000` — unchanged, healthy (200 at `/api/health`, PID 24896) |

## What the slice adds

- **Colour** — one swatch per paint opening one floating popover (saturation/value area, hue,
  alpha, RGBA, hex). It owns display state only: every authored value travels through the
  caller's existing colour/alpha write path, and one completed pointer gesture is one history
  entry. Escape closes it and restores focus; an outside press never steals focus from the
  control the user pressed.
- **Toolbar** — a fixed 40 px docked strip for the canvas tools, the grid, camera zoom/reset on
  the established `canvas-viewport-command` channel, the shared paint swatches, and the group
  and Boolean actions. View-only controls cannot write the document, and mounting, unmounting
  or repopulating the strip never moves the authored world (<= 1 px measured).
- **Menu** — the single right-click menu of the editor, shared by the stage and the outliner and
  openable from the keyboard. Every item runs an authority that already exists, so no action
  bypasses history; items are built from the live selection, the target is selected (or kept)
  before opening, a multi-selection survives, the native menu is suppressed, the panel stays in
  the viewport, and Escape / Tab / an outside press close it with focus restored.
- **Groups** — a group is a real container layer whose children point at it through the existing
  `parentId` relationship, so evaluation, save/load and OGraf export are unchanged. Group and
  ungroup re-express each child exactly (constant children exactly; animated children by an
  affine per-channel map while the composed container rotation is 0), each as one batch
  interaction and one history entry. Duplicating a group copies the whole group with fresh ids
  and re-parents every clone; deleting a group deletes the layers it owns.
- **Frame** — one aggregate selection frame per group, drawn from the live evaluated bounds of
  the layers inside it, decorative only (`pointer-events: none`, no hitbox).

## Validation (isolated `CI=1 PORT=5005` → UI 5188 / API 5005)

oxlint clean, `tsc -b` clean, vitest **145 files / 2219 tests**, `vite build`, OGraf manifest
validation, `qa:release` **2 passed**, `qa:v6` **3 passed**, `check-state-consistency` **pass
(42 checks)**, `npm audit --audit-level=low` **0 vulnerabilities**, `git diff --check` clean, and
the **full Chromium suite with `--retries=0`: 334 passed / 0 failed / 0 flaky / 0 skipped**,
including the new 14-case `e2e/authoring-ux-interactions.spec.ts`. No assertion, threshold,
skip or retry was weakened; `playwright.config.ts` was not edited.

## Self-review outcome (whole diff from `b453ba1`)

Two concrete findings were fixed: the group corner drag anchored on the container's own
(geometryless) bounds instead of the aggregate box the frame draws (measured ~48 px of
opposite-corner drift and a scale that crossed zero), and three Phase 6.4 specs measured stage
gestures at fixed coordinates that the docked 40 px strip pushed onto the timeline. Both fixes
are committed with a unit guard and real-browser assertions, and the affected suites were
re-run (plus the full Chromium suite after the product fix).

Everything else the review examined — shortcut leakage, focus traps, duplicate state
authorities, schema/runtime/export changes, colour alpha loss, group world/local transforms,
parent/group cycles, orphaning, selection hitboxes, camera drift, resize regression,
keyframe/sequence write leakage, save/load parity, a11y labels, reduced motion, viewport
overflow, z-index conflicts and stray artefacts — is recorded in
`progress_161_authoring_ux_final_slices.md` §7 with the outcome. Two pre-existing behaviours
that this branch did not introduce are reported rather than changed: the frame handles stay
interactive under the Pan tool (`startScale`/`startRotate` check only `appMode` and the
button), and a mousedown that lands on a layer belongs to that layer for every tool.

## Integration readiness (audit only)

`#4` (`main` ← `fix/authoring-ux-transform-toolbar`) → `#5` → `#6` → `#7` is a contiguous
stack: each base branch's tip is exactly the previous PR's head, so retargeting after each
merge is a base-pointer fast-forward that cannot drop a commit. All four are `MERGEABLE` /
`CLEAN` with green current-head CI. Runtime-parity **#3** was audited separately and is not
part of this stack. Four branches carry a docs-only tip (`#3`, `#4`, `#5`, `#6`), so the
validated *application* heads are `e5a2b8a`, `f13fed0`, `73dccbb` and `04dc182` respectively,
not the tips. After real integration to `main`, any RC or stable decision needs a **fresh
exact-SHA release smoke on the new `main` SHA**.

## Known group limitations (deliberately not fixed here)

Ungroup refuses while the group itself is keyframed; ungroup refuses a rotated group whose
children carry keyframed transforms (static children and translation/scale-only groups are
exact); grouping animated layers inside a rotated parent is refused; grouping refuses Boolean
operands and layers using a stage anchor preset; no canvas body-drag surface was added for a
selected group. Bind/Bond semantics were not changed or aliased.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.
