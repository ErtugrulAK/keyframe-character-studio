# Main integration plan (prepared, NOT executed — waiting for the user's approval)

Nothing below has been run. No commit, merge, push or copy into the main folder was made.

## 1. Current state (read-only checks, 2026-10-23)

| Tree | Branch / HEAD | Uncommitted |
|---|---|---|
| main `keyframe-character-studio` | `main` @ `39f6414` | the USER's files: `chatgpt_handoff/latest/manifest.txt` (modified), `.playwright-mcp/`, `EFFECTCRAFT_DEEP_ARCHITECTURE_RESEARCH.md`, `chatgpt_handoff/latest/{CHATGPT_UPLOAD_ONEFILE,progress_196…202}.md`, `reports/progress_189…202*.md`; a dev server (`npm run dev`, port 5173) runs from this folder |
| implementation `kcs-master-implementation` | `feature/motion/kcs-master-implementation` @ `39f6414` | ~170 entries: C2 + C3 + C4 work, the integrated Sprint 1 overlay, QA harness and reports under `reports/kcs-master-implementation/`; pre-existing untracked `.claude/skills/*` and `CLAUDE.md` (present at the C4 baseline, origin not this task) |
| Sprint 1 `.worktrees/s1-coordinate-overlay` | `feat/s1-coordinate-overlay` @ `39f6414` | 22 entries, unchanged by this task (read only) |

Overlap check: none of main's uncommitted paths is changed in the implementation tree, so a
merge cannot touch the user's files.

## 2. Sprint 1 → implementation (done in C4, reported here)

Copied as-is (new in the implementation tree): `src/utils/coordinateDisplay.ts`,
`src/components/Canvas/overlays/CanvasCoordinateOverlay.tsx`, `…/CanvasCoordinateReadout.tsx`,
`src/tests/coordinateDisplay.test.ts`, `src/tests/canvasCoordinateOverlay.test.tsx`,
`e2e/coordinate-overlay.spec.ts`.
Three-way merged against the shared base `39f6414` (`git merge-file`, outputs reviewed in
scratchpad first): `TransformPositionCard.tsx`, `AuthoringToolbar.tsx`, `AnimatorContext.tsx`,
`useTimeline.ts`, `authoringToolbar.test.tsx`, `useTimeline.test.ts` (clean);
`StageCanvas.tsx`, `StageCanvas.css` (one "both added at the same place" conflict each — the
implementation's stage banners/CSS and the sprint's readout/CSS; both kept, nothing dropped).
Follow-ups made for the combination: the overlay toggle is also in the ≤ 860 px View menu
(menuitemcheckbox); the extra View button made 1201–1366 px strips scroll → divider margins 4 → 2 px
and the first fold at ≤ 1279 px (sweep test 1440…720 px: no scroll at any width).
Not copied: the sprint's `chatgpt_handoff/*` documents and screenshots (handoff material, not product).
The sprint's own checks pass in the implementation tree (`coordinate-overlay` 4/4, unit tests).

## 3. What would move to main

All product changes in the implementation tree (C2, C3, C4, Sprint 1): `src/**`, `e2e/**`.
Proposed NOT to move without your decision:
- `reports/kcs-master-implementation/**` (reports, QA harness, logs, evidence PNG/JSON) — keep
  out of the product history, or one separate `docs:` commit without logs/evidence binaries;
- `.claude/skills/*`, `CLAUDE.md` in the implementation tree — pre-existing, not from this task;
- WP-08 — not implemented (schema decision pending, `09_WP08_DESIGN_PROPOSAL.md`).

## 4. Steps (each needs your go-ahead)

1. Review + USER ACCEPTANCE of the C4 items (manual checklist in `11_C4_RESULTS.md`).
2. In the implementation worktree, logical commits on `feature/motion/kcs-master-implementation`
   (Conventional Commits), e.g.: `perf(lists): window long layer lists` · `fix(broadcast): editor
   keys never reach the scene` · `feat(locks): enforce layer and mask locks on the write path` ·
   `feat(masks): path structure commands and keyboard point focus` · `feat(matte): track matte
   pick-whip` · `feat(parenting): re-base animated layers` · `fix(layout): short/narrow window
   space sharing` · `feat(canvas): coordinate overlay (Sprint 1)` · `test: …` (C2/C3 groups as in
   the earlier reports).
3. On that branch: `npx tsc -b`, `npm run lint`, `npm run build`, `npx vitest run`, full Playwright
   E2E on a dedicated port.
4. Safety point: `git tag pre-c4-integration 39f6414` (local tag only).
5. In the main checkout: `git merge --ff-only feature/motion/kcs-master-implementation` (main has no
   new commits; the user's uncommitted files are untouched because no path overlaps — git refuses
   rather than overwrite if that ever changed). No manual copying of files.
6. Re-run the gates of step 3 in the main checkout (fresh port; the running 5173 dev server will
   hot-reload — restart it if needed). Push only if you ask.
7. Sprint 1 worktree: leave as is until you decide; its content is in the branch.

## 5. Rollback

- Before the merge: nothing to undo (only the feature branch has commits).
- After a fast-forward merge on main: `git reset --keep pre-c4-integration` on main moves the
  branch back and keeps uncommitted user files (refuses if they would be touched); or `git revert`
  the merged range to keep history linear for others. Both need your approval.
