# Progress 176 — Main Integration + Mode-Swap Fade Fix — 2026-10-16

The user-approved MAIN INTEGRATION task for the PR #9/#10/#11 UI lineage: V3.4 manual-QA rounds through the V3.7 final micro-polish, branch `qa/pr9-pr10-combined`, head `2b14fa5`. Merge, targeted fix and gates only — no tag, no release, no npm publication, no API 5000 restart.

## Integration

- The lineage was integrated into `main` by fast-forward-only pushes and is on `origin/main`; no merge commit, no rebase, no force push, no history rewrite. Release tags `v1.1.0-rc.1` and `v1.1.0-public-controls` are unchanged. PR #9/#10/#11 handles are untouched.
- Validation ran in the isolated detached worktree `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\.worktrees\main-2b14fa5` (full `npm ci`, its own runtime SQLite DB); the stable QA surfaces were never used as the gate target.

## Regression the merge gate caught (and this task fixed)

- On `2b14fa5` two `timeline-marquee` specs (Escape-cancel and empty-space clear) failed deterministically — 8/8 sequential repeats, both worktrees — while the V3.6 head `d972a24` was 6/6 green on the same spec. Commit-level bisect landed on the style-only commit `4774b5f`.
- Root cause (measured, not inferred): the V3.7 chrome fade (`kcs-mode-enter`) is a plain mount animation, so it also played during the app's first paint. With the animation running, the timeline's playhead-follow scroll effect fired against the unsettled initial layout — after a keyframe click the grid scrolled (measured `scrollLeft` 0 → 711) and the marquee gesture began outside the grid (hit element `.ue-outliner-list`). On the V3.6 head the same click produced no scroll and the coordinates held.
- Fix `73fc000` (rides above `2b14fa5`): the fade belongs to the transition, not to the first paint. The mode authority (`src/hooks/useBroadcast.ts`) raises `modeSwapActive` only when the mode actually changes; the app shell (`src/App.tsx`) carries `kcs-mode-swap` on `.app-container` while the flag is set and lowers it on the enter animation's own `animationend`; the CSS animation and the `prefers-reduced-motion` exemption are scoped under that class (`src/kcsEditorTheme.css`). No timer, no playhead-logic change, no test-coordinate change, no sleep/skip/retry/tolerance hack. The 180 ms fade and the reduced-motion rule are preserved unchanged.
- New permanent pin: `src/tests/useBroadcast.test.ts` — the flag stays false on first render, rises on a real transition, is lowered by the shell, and re-asserting the same mode raises nothing.

## Validation ledger on the code head `73fc000`

* tsc `-b`/`--noEmit`, oxlint, production build: clean.
* Unit: 173 files / **2602 tests** passed (the V3.7 2601 plus the new pin).
* `timeline-marquee`: **6/6 twice** in isolation (workers 1, retries 0, isolated UI/API pair).
* Release QA: `npm run qa:release` — **Release gate passed for candidate SHA `73fc000a54c6c50ce21b71822c16a954a27399c4`** (2/2).
* FULL Chromium: **436 passed / 0 failed / 0 flaky** (workers 8, retries 0, UI 5188 / API 5017; live API 5000 never touched) in 3.3 m.
* Fix behaviour proof: computed `animationName` on the first-mounted `.sequencer-timeline` is `none`; clicking BROADCAST animates `.live-director-panel` with `kcs-mode-enter` while `.kcs-mode-swap` is on the shell, and the class is gone after the animation; switching back animates the timeline identically.

## Canonical sync disclosure

Canonical `main` was fast-forwarded `8e2df61 → 2b14fa5 → 73fc000` to match `origin/main`. The disclosed metadata-only `M` marker on `src/utils/matte.ts` was proven content-free first (HEAD/index/worktree blob all `96d0b4ad2bed3326f8ff4f8e5df552c2ec93a3b5`), the stale index was rebuilt from HEAD (`git read-tree HEAD`, a metadata-only operation), and the fast-forward checkout then resolved the marker; the file is the integrated `f8ec4cc` content. The user-approved integration supersedes the earlier "no further canonical/index repair" exception; this is the disclosure it required. The canonical tracked tree is clean at the delivered head; the untracked local file `EFFECTCRAFT_DEEP_ARCHITECTURE_RESEARCH.md` is the user's and was not touched.

## Verdict

Main integration complete on the gate-verified code head; the documents-only record rides above it as approved. No tag, no release, no npm publication.
