# OMP final response — QA aggregation: PR #9 + PR #10 combined (PR #11)

Status: **the two open pull requests now exist together on one branch, `qa/pr9-pr10-combined`, validated
at `ce04dd0`; PR #11 is open with green CI and 5173 serves it. Nothing merged, nothing released.**

## What was delivered

PR #9's latest head and PR #10's own commits now share one branch and one preview, so the user can run a
single combined manual QA pass instead of toggling between two worktrees.

- **Built from the right place.** `qa/pr9-pr10-combined` was created from
  `origin/fix/manual-qa-round1-remediation` (`fac2bc1`, the PR #9 head) — not from `main`, not from
  `P10`. `P10` does not contain `P9`, so only PR #10's *own* commits (`BASE..P10`, nine) were replayed,
  and only the first seven: `cd8fe7c` and `74603de` are PR #10-era documentation snapshots that would ship
  a stale state, so they were skipped and the combined handoff was written fresh instead.
- **One conflict, resolved additively.** `StageCanvas.tsx` is the only source file the two lineages both
  touch. The crop commit's import line clashed with PR #9's `workspaceLayout` import; both sides were
  kept. No conflict ever forced a choice between the camera fix and a PR #10 feature, and no P9 line was
  reverted.
- **Both sides are provably present.** PR #9: `workspaceLayout.ts` + `useDockedPanelEdge` + the
  `StageCanvas` frame-commit guard, both docked panels off browser-side width transitions, rounds 1–5, the
  playhead separation, the marquee normalization, Round-5 vector arrange. PR #10: `planDistributeByGap`,
  `resolveSnap` + guides + the snapping toggle, `stageCrop.ts` + ROI authoring + `Apply crop` + the two
  crop-to-content modes, and the crop's export parity through the shared resolution/transform document.
- **No duplicate authority.** `layoutGeometry.ts` holds the one union/centre formula and the one snap
  formula; `vectorArrange.ts` and `useStageCropAuthoring.ts` import it; `SNAP_THRESHOLD_SCREEN_PX` is
  defined there alone.

## Validation

`npx tsc -b` clean, `npm run lint` clean, `npm test` **169 files / 2537 tests**, `npm run build` clean,
`npm run check` green, `validate:ograf` valid, `PORT=5016 npm run qa:release` **2 passed**,
`PORT=5016 npm run qa:v6` **3 passed**, `node scripts/check-state-consistency.mjs` **PASS (52 checks)**,
`npm audit --audit-level=low` **0 vulnerabilities**, `git diff --check` clean.

Chromium, isolated ports only (UI 5188 / API 5016, `npm run dev` never used), `--retries=0`, no sleep, no
skip, no widened tolerance: focused camera/layout/crop/snapping/OGraf/GIF set **50 passed**; **FULL suite
406 passed / 0 failed / 0 flaky** at `--workers=8`, with `worstDelta=0.000px` on every dock/timeline
transition trace, `worstDrift=0.000px` per timeline-drag frame, and `dx=0.000 dy=0.000` world drift on
every repeated-toggle sample — against the unchanged 1px contract.

## Pull request

**#11 — OPEN, not merged** (`https://github.com/ErtugrulAK/keyframe-character-studio/pull/11`), base
`main`, head `qa/pr9-pr10-combined` at `ce04dd0a4972b69b4635e2d20995c642f6a67d14`; `MERGEABLE` /
`CLEAN`; CI Pipeline run `38583648143` → `success`; pushed with an explicit refspec, no force, no rebase.
**PR #9 (#9 HEAD `fac2bc1`) and PR #10 (head `74603de`) are unchanged and not merged**, and neither was
closed or edited.

## Live surfaces

5173 now serves `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-combined-qa` (vite listener
pid 17568; it was pid 50876 on the PR #9 worktree, and only that listener was stopped). Both lineages are
served from the same port: `GET /src/utils/workspaceLayout.ts`, `GET /src/hooks/useDockedPanelEdge.ts`
(PR #9 side) and `GET /src/utils/layoutGeometry.ts`, `GET /src/utils/stageCrop.ts` (PR #10 side) all
answer 200, and the served `StageCanvas.tsx` carries both the frame-commit guard and the snap/crop code.
**API 5000 (pid 18280) was never stopped or restarted.** No merge, no tag, no release and no npm
publication happened, and the canonical checkout was never written to. The user's combined retest against
5173 is the gate; the retest list and the still-open findings are in
`chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.
