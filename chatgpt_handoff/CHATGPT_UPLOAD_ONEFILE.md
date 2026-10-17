# KCS — Post-PR14 Docs Sync + SAFE-02 Preflight

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.

## README.md

# KCS Post-PR14 Docs Sync + SAFE-02 Preflight Handoff

This task-specific bundle carries the post-merge round: the documentation reconciliation for the safety track (PR #12 N1, PR #13 SAFE-01, PR #14 N3 PR-1 all MERGED into `main`), the verified Git/CI ledger at the new `main`, and the READ-ONLY SAFE-02 implementation-readiness analysis. No SAFE-02 code was written this round.

## Current engineering record

- Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (`main`); inspected SHA `84ca0acb701ffbba7d49d5719e6799cd94337395` (merge commit of PR #14; local main fast-forwarded to match `origin/main`; the docs/bundle commits ride above it).
- Status: **SAFETY TRACK MERGED — N3 PR-1 ON MAIN — SAFE-02 PREFLIGHT COMPLETE, IMPLEMENTATION NOT STARTED — NO RELEASE — NO TAG — NO PUBLISH — NO WORKTREE CLEANUP.**
- Merged PRs: #12 (N1 restore/undo baseline) at `6b86b29`; #13 (SAFE-01 autosave CAS ownership) at `5ee9909`; #14 (N3 PR-1 bounded numeric import acceptance) at `84ca0ac`, reviewed head `cf4a4fd`, post-merge CI run 38948404230 SUCCESS.
- Release inventory untouched: `v1.1.0-rc.1` (draft), `v1.1.0-rc.2` (public prerelease), `v1.1.0-public-controls`; package metadata stays the private `1.1.0-rc.1`. The `v1.2.0-rc.1` proposal still awaits the user's version approval.
- N3 PR-1 policy now enforced at the single import boundary: finite fps 0.5–240, integer totalFrames 10–1200, canvas edges 2–16384 (fractions legal for Lottie), legacy mirror rules + numeric-version guard, `sanitizeProjectFps` round-to-zero floor. Records: `reports/progress_178..181`, changelog Fixed entries.
- SAFE-02 readiness: feasible as a small independent PR — one production file, ~60–90 lines, three lock sites, feature-detect fallback (jsdom has no `navigator.locks`), units with a mock lock queue plus real two-tab Chromium contention tests (the test tabs can hold the named lock open deterministically). Mount-time restore stays lock-free (async boot would break the N1 baseline contract). Two decisions await the user: (D1) manual-save queue policy — recommended FIFO queue with bounded wait surfacing the conflict UI on timeout; (D2) `storage` events — recommended deferral (visibility, not safety). Full ten-point analysis: `OMP_FINAL_RESPONSE.md`, "SAFE-02 implementation-readiness preflight" addendum.
- Surfaces: 5173 (pid 34332) and API 5000 (pid 32588) kept running and untouched; 4312 never started; the four retained worktrees (`pr12-final-qa`, `restore-undo-s0`, `n3-import-boundary-pr1`, canonical) and all `.research/` folders preserved; the user's untracked `EFFECTCRAFT_DEEP_ARCHITECTURE_RESEARCH.md` untouched.

## Record precedence

The docs-sync round's `OMP_FINAL_RESPONSE.md` addenda (N3 PR-1 + SAFE-02 preflight), the manifest and `PROJECT_STATE.md`/`NEXT_SESSION.md` mirrors are the current task authority. Earlier addenda and retained records are historical snapshots or exact mirrors; their counts and positions are context, not current state.

## SAFE-02 implementation addendum — 2026-10-17

- Status: **SAFE-02 IMPLEMENTED — PR #15 OPEN — GATE + CI GREEN AT `af3d7ba` — RELEASE/TAG/PUBLISH UNTOUCHED.**
- The autosave critical section is now serialized behind the Web Lock `kcs-autosave:SEQUENCER_STUDIO_PRO_V5`: interval ticks skip-if-busy (never queue), manual saves queue FIFO with a bounded 1 s wait whose timeout is an honest info notice (`manualSaveRejectedAt` + one toast per event) and never a fake conflict, and reset's key removal runs inside the same grant with a settle-epoch re-arm. Without `navigator.locks` the exact SAFE-01 synchronous window runs unchanged (jsdom included). Preflight decisions landed as recommended: D1 = queue with bounded wait, D2 = no `storage` events.
- Deltas beyond the preflight: three production bugs surfaced only under live Chromium or CI mode — `ifAvailable` contention hands the callback `null` (not `undefined`); the DEV StrictMode cleanup poisoned the unmount flag (now re-armed at setup); the notice guard needs `typeof === 'number'` because partial context mocks leave `undefined`. The manual save is asynchronous by API nature, so the badge surfaces `data-last-saved-at` and 16 e2e helpers wait that clock instead of reading storage the moment the click returns.
- Validation: unit 2677/2677 in normal and CI mode; full chromium green at the final head; `qa:release` exact-SHA gate PASS at `7739f81`; Actions Verification PASS at `af3d7ba`. Record: `reports/progress_182_safe02_web_locks.md`.
- Retained environment note: an external process twice reverted in-flight working-tree files to HEAD during this round (test file, then HeaderBar); all work was rebuilt, staged immediately, and backed up outside the repo. Cause unidentified.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. The one-file is regenerated from this scoped handoff before delivery; do not upload individual bundle files.

## OMP_FINAL_RESPONSE.md

# PR #11 Combined Manual QA Remediation

## Scope and protected boundaries

Worktree: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-combined-qa`.
Branch: `qa/pr9-pr10-combined`. Starting head: `784a8c235372f6f984f32e744894bfbb3c086f80`.
Only the approved findings are addressed. No merge, release, tag, npm publication, rebase, force push, branch deletion, dependency change, workflow change, or API 5000 restart.
PR #9 remains OPEN at `fac2bc191724165540cf0f7cc53b7941d737919d`; PR #10 remains OPEN at `74603dea5f57d1d586e3ec8c97bf09c304c4ca8a`. Neither history was changed.

## UI polish V3.6 addendum — 2026-10-15

Supersedes §5 (command naming/order), §6 (panel copy) and §9 (row density) of this record. The user's combined-round retest produced nine UI findings, fixed and browser-measured before/after on the same branch (full detail: `reports/progress_174_combined_pr9_pr10_ui_polish_v36.md`):

1. **Draw cursor.** Armed primitives set `drawing-tool` on the stage container; CSS owns the crosshair (container + svg); Escape/tool-switch returns `default` in the same paint. Measured `default→crosshair→default`.
2. **Dock width contract.** One token block on `.app-container` (rail 56 / drawer 304 / inspector 372) replaces five scattered declarations incl. the theme's hard 280px drawer line; dock handles derive from the same tokens. Measured 280→304 and 360→372 with the handles still boundary-centred.
3. **GIF panel.** Footer Close, the note paragraph and the Format-limitations details removed (X/Escape/outside-press unchanged); the 20 ms sampling fact moved to the frame-rate select tooltip, transparency/text-font facts to the Export button tooltip. Summary (frames/duration/size) stays visible.
4. **Toolbar command set.** Align band in the required order — Align Left/Right/Top/Bottom, Center (both axes, one undo), Center Horizontally/Vertically (one axis each) — and exactly one gap-based Distribute per axis. The confusing centre-spacing distribute duplicate left the UI; the pure `planDistribute` authority stays (documented policy test), the hook's dead arm was deleted. Labels are exact; no menu hop on desktop.
5. **Corner resize.** `isScaleLocked` defaults false and the corner drag solves `uniform: isScaleLocked !== e.shiftKey`: free non-uniform by default (pointer X→scaleX, pointer Y→scaleY), Shift = uniform for one drag, the Inspector glyph = persistent option; groups ride the same branch. Four new browser tests pin default-free, Shift-uniform, locked-uniform, locked+Shift-free and a free group corner drag.
6. **Select focus.** `select` is always `:focus-visible` in Windows Chromium, so the KCS teal ring is pinned explicitly (`select:focus{outline:none}` + important teal `:focus-visible`): the white 3px browser ring is gone in both focus paths; buttons/inputs keep pointer-clean behaviour.
7. **Mode segment.** Three stacked CSS generations (glowing text-shadow, bouncing bright indicator bar, keyframes) and inline markup styles replaced by one definition: bordered rail, sliding indicator, unmistakable pressed half, no glow anywhere; `aria-pressed` semantics unchanged.
8. **Shortcut Reference.** Rows became `grid: minmax(0,1fr) auto` with 22px keycaps and inline detail/scope chips; names/details are one line with ellipsis and the full sentence in the row tooltip. Measured max row height 124px→31px (before: uniform 47px), 28 rows intact.
9. **Restore provenance (LAN).** `useSerialization` exposes `restoredFromLocalStorage` (set only when the startup autosave restore fills the document; cleared by import/reset), the context carries it, and the header shows a neutral chip "Restored from this browser's autosave" — the case that matters when the other PC opens the editor over the LAN and localStorage differs per origin.

Gate on the V3.6 head: tsc/lint/build clean; unit 173 files / 2599 tests; FULL Chromium **426 / 0 failed / 0 flaky** on the isolated QA config (UI 5188; live API 5000 never touched). New permanent pin: `e2e/ui-polish-v36.spec.ts` (8 tests); five existing specs migrated to the new contracts instead of re-pinning removed UI.

V3.6 retest (in addition to the 12 items above): (a) draw with a rectangle tool — crosshair, preview under it, Escape restores; (b) corner-drag a group freely, then with Shift — uniform; (c) click a select — teal ring, no white; (d) toolbar order/names vs the list; (e) GIF panel footer single button + tooltips; (f) mode segment visual; (g) shortcut density; (h) chip visible on a restored project, gone after Reset.

## Final micro-polish V3.7 addendum — 2026-10-15

The user's V3.6 retest passed six surfaces and rejected the residual polish items; this round implements exactly the approved six, presentation and structure only — no behaviour, no feature, no timeline/mask/matte work, no merge. Full record: `reports/progress_175_pr11_final_micro_polish_v37.md`.

1. **Toolbar grouping.** Align (four edges) / Center (three) / Distribute (two) / Rotate-Flip (four) are four announced groups behind the compact separators; the shared `ArrangeButton` keeps one copy of the command-button markup. The both-axes `Center` glyph is the four-arrow centred target (`Move`, no circle), distinct from both one-axis centre icons. Same commands, same order, same authorities; no dropdown.
2. **Left rail + handles.** Rail items 42px tall, 18px icons on one optical scale, one 10px/500 label voice (no wrap), active = light teal surface + 2px accent bar (the translateX nudge deleted). Collapse handles are quiet boundary-flush tabs (panel surface + hairline border, unified radius) across left/right/timeline members. Widths untouched: the 56/304/372 token contract stands.
3. **Focus visual.** One authority: keyboard `:focus-visible` is a 2px teal ring at `outline-offset: -2px` — inside the box, never an outer frame; the select keeps its explicit always-inset statement; seven scattered positive-offset component rings were folded in. Pointer focus stays clean; nothing lost its indicator.
4. **Mode transition.** Entering a mode fades the incoming chrome (toolbar, docks, timeline/Live-Director swap) through one `kcs-mode-enter` keyframe: 180ms ease-out, opacity + 3px paint-only translate, `prefers-reduced-motion` → none. No React timers; the stage never animates (it stays mounted); rapid switching restarts the CSS animation and the edit camera returns to the identical reading (polled, exact).
5. **Shortcut Reference.** A dense single-column reference sheet: slim header with search, hairline category bands (no card boxes), command left / keycaps right on one ≤34px line, full explanations in the row tooltip, short-window scroll preserved, Windows/macOS display from the one `utils/shortcuts.ts` table.
6. **GIF sampling verified, not guessed.** 120 FPS is the sampling grid; the encoder honours the GIF centisecond floor. Measured through the real plan + real writer + independent byte reader: 0.50s → 25 frames / 50 cs, 1.00s → 50 / 100 cs, 2.00s → 100 / 200 cs — the reported "100 frames at 120" was the mathematically correct 2s row, so no functional fix was warranted. The control is renamed **Sampling rate**; the existing tooltip answers the presentation-rate question; no explanatory footer returned.

Gate on the V3.7 head: tsc/lint/build clean; unit 173 files / 2601 tests; FULL Chromium **436 / 0 failed / 0 flaky** (workers 8, retries 0, isolated UI 5188 / API 5017; live API 5000 untouched); state consistency 56 checks; audit 0. New pins: `e2e/micro-polish-v37.spec.ts` (8 tests — band separation, glyph distinctness, rail compaction + restraint, inset keyboard ring vs clean pointer focus, crossfade + reduced motion, rapid-switch camera identity, sheet layout, handle family) and three parameterised 120-sampling rows in `e2e/gif-export.spec.ts`.

Final user retest (6 items): (1) toolbar grouping + Center icon acceptable; (2) rail buttons and both collapse handles look cleaner; (3) no outer focus frame, Tab still visible as a subtle inset ring; (4) Edit ↔ Broadcast transition smooth, no stage/camera jump; (5) Shortcut Reference compact/readable; (6) GIF 0.5s/1s/2s at 120 shows 25/50/100 frames with 0.50/1.00/2.00 s total. If these pass: STOP polish — PR #11 is ready for a separate MAIN INTEGRATION + VERSION CHECKPOINT task. **NO MERGE in this task.**

## Main integration addendum — 2026-10-16

The user approved continuing the MAIN INTEGRATION task with a targeted fix for the failure this task's own merge gate surfaced. Full record: `reports/progress_176_main_integration_mode_swap_fix.md`.

Integration: the PR #9/#10/#11 UI lineage (branch `qa/pr9-pr10-combined`, V3.4 manual-QA rounds through the V3.7 final micro-polish, head `2b14fa5`) was integrated into `main` by fast-forward-only pushes; `main` is at or after `73fc000`, matching `origin/main`. No merge commit, no rebase, no force push; tags unchanged; no npm publication; PR handles untouched. Validation ran in the isolated detached worktree `.worktrees/main-2b14fa5` under the canonical repo root, with its own `npm ci` install and runtime DB.

Regression the gate caught and the fix: two `timeline-marquee` specs failed deterministically on `2b14fa5` while the V3.6 head `d972a24` was 6/6 green — commit-bisected to the style-only commit `4774b5f`. Measured cause: the `kcs-mode-enter` chrome fade is a mount animation, so it also played on the app's first paint; during it the timeline's playhead-follow scroll fired against the unsettled initial layout (clicking the frame-40 key scrolled the grid `scrollLeft` 0 → 711) and the marquee press landed outside the grid (elementFromPoint: `.ue-outliner-list`). Fix `73fc000` keeps the fade as the transition it was designed to be: `useBroadcast` raises `modeSwapActive` only on a real Edit ↔ Broadcast change, the app shell carries `kcs-mode-swap` on `.app-container` while it is set and lowers it on the enter animation's own `animationend`, and the CSS animation plus the reduced-motion exemption are scoped under that class. No timer, no playhead-logic change, no test-coordinate change, no sleep/skip/retry/tolerance hack; the 180 ms fade is visually identical. Behaviour proof: computed `animationName` `none` on first mount, `kcs-mode-enter` on both swap directions, class lowered after the animation. New permanent pin in `src/tests/useBroadcast.test.ts`.

Gate ledger on code head `73fc000`: tsc/oxlint/build clean; unit 173 files / 2602 tests; `timeline-marquee` 6/6 twice in isolation (workers 1, retries 0); `npm run qa:release` — release gate passed for the candidate SHA; FULL Chromium 436 passed / 0 failed / 0 flaky (workers 8, retries 0, isolated UI 5188 / API 5017; live API 5000 never touched).

Canonical sync supersedes the 8e2df61 position claim and the metadata-only dirty-STOP exception stated above: the `matte.ts` marker was proven content-free (HEAD/index/worktree blob all `96d0b4ad2bed3326f8ff4f8e5df552c2ec93a3b5`), the stale index was rebuilt from HEAD (metadata-only), and the approved fast-forward checkout resolved the marker; canonical main/origin/main carry the delivered head and the tracked tree is clean. The untracked local research file on the canonical tree is the user's and was not touched. Live surfaces: 5173 now serves the canonical `main` checkout; API 5000 (listener 2308) was never restarted.

## Version checkpoint addendum — 2026-10-16

Audit-only on the version axis; full record: `reports/progress_177_version_checkpoint_desktop_cleanup.md`. Inventory (read-only): `origin` tags `v1.1.0-rc.1` (→ `46d2a3e…`, draft prerelease), `v1.1.0-rc.2` (→ `6c27ef3…`, public prerelease, run 37752015020) and `v1.1.0-public-controls` (→ `6351d1a…`) left exactly as found; `package.json`/`package-lock.json` stay `1.1.0-rc.1`, `private: true`, never npm-published; the OGraf contract is the EBU v1 schema and the project format stays `version: 1` with legacy acceptance; no in-app version string exists. Assessment: the delta since the last candidate is backward-compatible capability plus defect fixes with no API/format break → **`v1.2.0-rc.1` (minor) recommended, pending the user's explicit approval**; the approved surface removals (legacy single-file `.mjs` OGraf export entry, header `?` help, duplicate Inspector keyframe controls) belong to the changelog's Removed disclosure. Nothing was bumped or tagged; the bump's file list and the rc.1/rc.2 exact-SHA cut procedure are in the report.

Desktop cleanup: `git worktree list --porcelain` plus per-folder tracked/untracked/ignored sweeps, ancestry proofs, `ls-remote` preservation checks and a process/port scan; the three retired `-omp-*` QA worktrees were removed with plain `git worktree remove` (no `git clean`, no reset, no force, no branch deletion, no user-file moves). Kept untouched: the user's `KCS\` host folders and archives, the active research model's desktop `effectcraft-reference-20261015` and `EFFECTCRAFT_DEEP_ARCHITECTURE_RESEARCH.md`, `ograf-studio-stable`, and all in-repo `.research/` clones. The workspace standard (temporary worktrees under `.worktrees/`, external clones under `.research/`, repo-local exclude only) was enforced; when the research clones made a bare unit run collect 152 external test files, the vitest collector was scoped to the standard (tooling commit `ef1d43e`) — no KCS test, assertion or threshold was touched. Re-validation on `ef1d43e`: unit 173/2602, FULL Chromium 436/0/0 (workers 8, retries 0), release gate passed for the exact candidate SHA, state consistency 57 checks PASS, `npm audit` 0, first-paint fade exemption re-verified live on the canonical-served 5173; API 5000 never restarted.

## SAFE-01 autosave ownership addendum — 2026-10-16

Production-safety round on the shared-key autosave engine; full record: `reports/progress_180_safe01_autosave_ownership.md`. Four loss modes were verified against the code before any change: the interval tick serialized unconditionally (idle tabs rewrote the key), external writes were never observed (lost updates), the conflict check compared a stale in-memory value (blind CAS), and the first completed tick captured whatever the document happened to be — an edit inside the first 10 s permanently froze the baseline and silently disabled autosave behind a healthy badge.

`useSerialization` now keeps three pieces of ownership state and nothing else changed: `storageKnownRef` (the exact string this tab last read at boot — a refused value included — or wrote), `settledSaveRef` (the serialized document the tab's state settled to; re-armed to null when a restore applies or when import/reset replace the document) and `autosavePausedRef` (event-loop-safe mirror of the conflict pause). A tick writes only when the candidate differs from the settled capture and the live key still equals the known value; success adopts the written string, mismatch adopts the observed value and pauses with the amber `--paused` badge plus a one-time toast. Manual save shares the same CAS path and never force-overwrites across a detected conflict; import and reset are explicit document replacements and lift the pause deliberately. The read-to-write window inside one browser profile remains the documented residual race — pinned honestly by K1 rather than claimed fixed; the multi-tab token protocol stays the deferred SAFE-02 decision.

Validation at merged head `2f56015` (PR #13, merged into `main` at `5ee9909`, head branch auto-deleted): CI `Build, Lint & Test Verification` pass; exact-SHA `npm run qa:release` pass on a fresh build; full vitest 2623/2624 with the only failure being the local `main`-drift guard of `stateConsistencyCheck` (green on CI); FULL Chromium **444 passed / 0 failed** (441 plus the new two-tab specs N1/K1/K2/H1); nine focused units 9/9; the external s0 harness stayed 0/3 with exit 0 on the final bundle.

## N3 PR-1 import-boundary addendum — 2026-10-16

Import-boundary hardening round; full record: `reports/progress_181_n3_import_boundary_pr1.md`. Seven findings were re-confirmed first-hand at base `f45f8b1` against the code (not inherited from the earlier audits): the scene boundary accepted `fps: 0.4` and the state sanitizer rounded it to zero, freezing the playhead through `1000 / 0 = Infinity` with no diagnostic; `totalFrames >= 1` was accepted while the state silently clamped `[10,1200]` and rounded (accepted ≠ applied); canvas edges accepted any finite positive number (1e9 into viewBox/stage bounds/GIF canvas plan); the legacy route carried no numeric policy at all; and a numeric unsupported version re-routed through the legacy shape and imported.

The fix lives only in the boundary and the sanitizer: bounded numeric acceptance on BOTH document kinds — finite fps within 0.5–240, integer totalFrames within 10–1200, canvas edges within 2–16384 with fractions legal for Lottie-mapped sizes, the legacy `projectResolution` numeric edges carrying the same range (a non-object keeps the documented drop-to-default narrowing), a numeric-version guard refusing scene versions outside [1,2] on the legacy route, and a round-to-zero floor in `sanitizeProjectFps` as defense-in-depth for every caller. Refusals remain single-diagnostic with stable codes (`KCS_IMPORT_INVALID_TIMELINE`, `KCS_IMPORT_INVALID_CANVAS`, `KCS_IMPORT_UNSUPPORTED_VERSION`) and exact `$.` paths; nothing is silently repaired; absent fields keep their documented defaults.

Validation at head `cf4a4fd` (PR #14, since MERGED into `main` at `84ca0ac` by the repository's normal GitHub merge — post-merge CI run 38948404230 success; head branch and worktree retained pending cleanup approval): full vitest 2665/2665 including 34 new boundary/sanitizer rows and four real-hook apply guards proving zero state setters and no history-baseline request for refused documents and tampered restores; full Chromium 443 passed + 1 environmental flake (history-restore under workers-4 contention — passed on its own retry and 5/5 isolated, all its seeds in-policy); lint/tsc/build/validate:ograf/diff-check clean; `npm run qa:release` passed for the exact SHA on a fresh build; PR CI `Build, Lint & Test Verification` pass at the SHA. One e2e seed was aligned to honesty: `v51-recovery` declared 1800 frames, a value the state always silently clamped to 1200 — the seed now says 1200, the identical effective timeline. Deliberate tightenings (compat suites green): non-numeric fps/totalFrames on the legacy route now refuse instead of silently defaulting, and an out-of-range numeric legacy resolution edge refuses instead of dropping to defaults. Deferred per the audit backlog: keyframe frame-range and id uniqueness (C4), canvas JSON-drop choke (C5), media caps (C6), channel-key allowlist (C8), FileReader pre-check (C9), id hygiene (C11), preset-library read (C12).

## SAFE-02 implementation-readiness preflight — 2026-10-16 (read-only, no code written)

Executed at `main@84ca0ac` (PR #14 merged; reviewed head `cf4a4fd` contained; post-merge CI run 38948404230 success). Companion reads: `reports/progress_180_safe01_autosave_ownership.md`, the current `src/hooks/useSerialization.ts` and both autosave suites. No OpenCode SAFE-02 research file exists under `.research/` (verified: n3-import-boundary-preflight, targeted-audit, pr12-* folders are present; no safe02 folder) — so this preflight stands on the code and the SAFE-01 record alone.

**1. Writers/removers of the shared key — single choke point, confirmed.** Every mutation of `SEQUENCER_STUDIO_PRO_V5` lives in `useSerialization.ts`: the CAS write in `performSave` (`:621`), the stickman-cleanup `removeItem` (`:525`), the reset `removeItem` (`:745`) — reads: boot adopt (`:492`), CAS pre-check (`:607`), import adopt (`:653`). No `storage`-event listener and no other key writer exists in `src` (grep-proven; only `constants.ts` names the key). No `navigator.locks`/`BroadcastChannel` usage anywhere yet.

**2. Web Locks wraps the real critical section without touching the ownership contract — feasible.** The section is the synchronous `getItem → compare vs storageKnownRef → setItem → adopt` block inside `performSave`. `navigator.locks.request('kcs-autosave:' + AUTOSAVE_STORAGE_KEY, …)` serializes exactly that across same-origin tabs; the three SAFE-01 refs (known/settled/paused) remain the single ownership authority — the lock only guarantees that two cooperating tabs cannot interleave their read-modify-write, closing the documented K1 residual race. Both `removeItem` sites are mutations and must take the same lock name.

**3. Browser support — verified fact vs assumption.** Verified against MDN/W3C this session: Web Locks is Baseline "widely available" across browsers since March 2022 (Chromium/Edge, Firefox 96+, Safari 15.4+). KCS's dev and QA target is Chromium, so production support is a non-issue; the fallback question is for exotic hosts. REQUIRED: a feature-detect (`if (navigator.locks) … else today's exact synchronous path`) — jsdom has no `navigator.locks`, so the fallback is not optional: it is the unit-test environment's path and must be pinned as its own test, explicitly, never silently.

**4. Manual save against a busy lock — recommended default:** queue (Web Locks is FIFO), do not drop, keep the button feedback unchanged while pending. DECISION for the user: whether a queued manual save gets a visible "Queued" hint and a timeout cap (unbounded waiting behind a stuck holder is the risk; recommend a bounded wait with the conflict-pause surface as the honest failure mode).

**5. `storage` events — recommend DEFER.** SAFE-01's CAS already converts every real overwrite attempt into a visible pause. A `storage` listener would additionally pause the victim tab even if it never writes again (earlier detection, but more state churn, StrictMode double-subscribe care and new test surface). It is a visibility improvement, not a safety one; ship it as SAFE-02b only if the user wants live cross-tab notice.

**6. reset/import/stickman cleanup vs locking.** The stickman branch (`:525`) runs synchronously inside the mount restore effect — wrapping it in an async lock would make boot restore asynchronous and break the N1 contract (the history baseline must be requested in the same mount pass; `historyRestoreBaseline.test.tsx` pins it). RECOMMENDED: leave mount-time reads and the stickman deletion lock-free (they are one-shot boot-time; competing tabs are not mid-restore), and lock only the two user-triggered mutations (CAS write, reset `removeItem`) plus import adopt. DECISION for the user: accept the narrower lock surface (recommended) vs full-lock (rejected here with the N1 evidence).

**7. What Web Locks cannot guarantee — must stay in the docs.** It is advisory and cooperative: a tab running a PRE-SAFE-02 build never takes the lock (deploy window risk: one stale page session reopens the race); it does not serialize against devtools/manual `localStorage` edits (same-origin, so out of reach anyway); it does not make `setItem` itself atomic — localStorage is already per-operation serialized by the UA; the race SAFE-01 documented is the interleaving of two read-modify-write sequences, and that is precisely what the lock removes. The crash-mid-write story is unchanged (storage either holds the old or the new complete value).

**8. Regression-test strategy.** Units (jsdom, deterministic): mock `navigator.locks` with a controllable queue — assert (a) the CAS block runs only while the named lock is held, (b) two parallel `performSave` calls serialize (no interleaving), (c) the no-locks fallback takes today's exact path, (d) reset takes the lock, (e) manual save queues rather than drops. Playwright two-tab Chromium (the API's real strength — locks are OS-level cross-page): (f) tab B holds `kcs-autosave:…` open via `page.evaluate(() => new Promise(...))`, A's tick and manual save block and the badge state stays honest; (g) upgraded H1: both dirty tabs write under the lock — the loser ALWAYS ends `--paused`, never a silent overwrite; (h) lock released ⇒ the queued write lands within one interval. No production test seams: contention is driven from the test tabs themselves.

**9. N1 and N3 interactions.** N1: untouched if mount stays lock-free (see 6) — and the settle re-arm semantics of SAFE-01 are unaffected because the lock wraps only the write decision, not the capture. N3: `validateImportedDocument` is a pure function; refusals never reach storage — zero interaction; import adopt (`:653`) is a read + ref adoption and may optionally run under the lock for exactness (recommended yes: adopting an observed value that changes one microtask later is exactly the class of lie SAFE-01 refuses to keep).

**10. Size verdict — YES, SAFE-02 can be a small independent PR.** One production file (`useSerialization.ts`, roughly +60–90 lines: a `withAutosaveLock()` helper, lock-wraps at 3 sites, feature-detect fallback), the two existing autosave suites extended, one new e2e file. No public API change, no state-model change, no UI change unless the queued-save hint (decision 4) is approved. Implementation REQUIRES the user's go-ahead plus answers to two open decisions: (D1) manual-save queue policy (default recommended: FIFO queue, bounded wait, conflict surface on timeout); (D2) storage-event deferral (default recommended: defer).

## Findings, root causes, and fixes

### 1. Persistent primitive creation

The StageCanvas mouse-up completion cleared the armed creation tool. Completion now retires only the current gesture/preview. Rectangle, Square, Circle, Triangle, Star, Rhombus, Parallelogram and the shared primitive path remain armed; Escape or another tool exits. Each completed shape keeps its own existing history transaction. Free Draw retains its separate multi-vertex Enter/double-click commit and Escape-cancel lifecycle.

### 2. Property channel semantics

Legacy composite projection created apparent child-property keys from unchanged full poses. The canonical legacy-to-channel conversion now uses the owned authored base pose: moving channels and held overrides different from that base survive, while provably unchanged composite fields do not become authored channels. Explicit canonical held keys are never pruned. Static full-hold scopes and unknown-base legacy data remain intact.

Evaluation, migration, import/export, timeline projection, navigation and authoring use the same conversion. Untagged legacy keys and explicit `Sequence` keys share one semantic scope during conversion/deduplication, preventing interpolation loss after reload. Position/X/Y reflect the actual canonical channel keys; Rotation, Scale and Opacity no longer inherit aggregate keys. Explicit Rotation keys remain independent. Layer aggregate navigation follows the real projected frames. The existing **Add Composite Keyframe** command intentionally still captures the full pose; it is not a Position-only command. Inspector edits do not create a second keyframing authority.

### 3. Rotated-child group resize

The old scalar TRS fold applied group anisotropic scaling along a rotated child's local axes. For an old group box and new group box, the resize uses the existing solve-frame mapping: `p_new = anchor + diag(sx, sy) * (p_old - anchor)`. The fixed opposite edge/corner is the anchor. Every child world matrix is `W_child = W_parent * L_child`; the shared affine inverse maps world edits back into the original parent space.

A 90-degree child can exchange the scale-axis reading, but an arbitrary 30-degree child under unequal world-axis scaling generally produces shear. The user explicitly approved extending the existing transform authority to represent this exactly. A derived affine matrix is carried through evaluation, rendering, geometry/bounds, hit interaction, selection/gizmos, masks/mattes, boolean/freeform geometry and OGraf runtime output. No new persisted transform field or parallel resize engine was introduced; authored local rotation is preserved. World x/y denote the actual affine origin. Inspector and bonded edits share the canonical world-to-local conversion and a correctly rebuilt post-edit parent matrix, avoiding double movement/stale affine state.

Regression coverage includes 90/30-degree children, nested groups, negative scales, horizontal/vertical/corner transforms, fixed opposite anchors, undo/redo, and deep sheared-parent inspector/bonded edits. The corner browser oracle now independently multiplies fixture matrices instead of repeating the obsolete TRS assumption; existing tolerances are unchanged.

Production review also found that serializing individual affine helpers with `.toString()` leaked minified outer identifiers into exported OGraf modules (`ReferenceError: Lt is not defined`). All existing affine functions now come from one self-contained `createWorldAffineAlgebra` factory, embedded as a whole in runtime output. An in-memory real production-minification regression checks independently known deep affine geometry. Actual built-UI export/host smoke loaded `graphic.mjs` with status 200, painted one layer, and matched the serialized world origin exactly.

### 4. Snap-guide invariant

The snap resolver now returns the committed line and the perpendicular extent covering the moving and target bounds. A stage-reference guide spans the relevant moving band instead of an arbitrary full canvas. StageCanvas renders the same resolved geometry in editor coordinates in the same drag update as the snapped transform. X and Y remain independent; switching candidates, unsnapping and mouse-up retire the corresponding guides. Thin accent guides remain pointer-events none.

Invariant: a resolved authored-axis correction has its corresponding rendered guide; guide position and extent come from that result, not a separately recomputed candidate. Tests cover result-to-render geometry, both axes, stage references, switching and cleanup. A pre-existing browser helper issued zoom keys faster than the camera commit; it now waits for the observed DOM zoom after each action, without sleeps, retries or threshold changes.

### 5. Direct toolbar and distribution naming

Normal desktop shows direct Align Left / Horizontal Centers / Right / Top / Vertical Centers / Bottom, Distribute Horizontal / Vertical, Rotate CCW / CW, and Flip Horizontal / Vertical buttons. There is no normal-desktop Align/Distribute dropdown. Center Horizontally / Vertically retain the existing center-based distribution policy under explicit names. Distribute Horizontal / Vertical retain equal visual edge-gap policy; no behavior/name swap.

Existing world visual bounds, group aggregates, outer-span preservation and one-undo distribution authority remain. Different sizes and rotated layers retain correct geometry. The toolbar fits measured 1280px and 1440px desktop widths without horizontal overflow.

### 6. GIF panel and 120 sampling

The compact dialog uses the existing floating-panel outside-press authority, viewport max-height/scrolling and a collapsed format disclosure. Inside clicks keep it open; outside clicks and Escape close it. Export cancellation on unmount remains intact. The measured dialog height changed from 304.625px to 259.875px.

120 FPS is a **sampling-grid option**, not a claim that GIF viewers present at exact 120 FPS. GIF delays are centiseconds, and Chromium maps delays at or below 10ms to 100ms: https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/graphics/deferred_image_decoder.cc . Emitted frames therefore have at least 2cs delay (at most 50 presented frames/s). The plan uses `totalCS = max(2, round(durationSeconds * 100))`, chooses at most 900 frames and at most `floor(totalCS / 2)`, samples across the complete authored duration on the requested grid, and quantizes cumulative delay boundaries to sum to totalCS. The frame cap no longer truncates long animations. Duration accuracy is the nearest centisecond, with the unavoidable 20ms minimum for extremely short clips. A one-second 120-sampling export is 50 frames / 1.00s, not a sped-up animation. Tests check exact delay sum, long duration/frame cap, and actual downloaded half-second GIF movement and 50cs total delay.

### 7. Inspector keyframing controls

Duplicate Trim Path and mask Add/Remove Keyframe controls and their unused callback forwarding were removed. The Inspector keyframes view is read-only projection/navigation rather than an additional add/delete/frame-timing editor. Value and path editing remain. Animation data is not deleted; timeline/property tree `[previous][add/remove][next]` remains the keyframing authority.

### 8. Routine toasts and panel handles

Routine rotate/flip/align/distribute success toasts were removed; arrange already had no routine success toast. Blocked/unavailable feedback, errors, real warnings and significant export/save feedback remain. The 20x46px sidebar hit targets now straddle the empty panel boundary gutters; panel text/cards are not covered. Existing top anchoring, frame-committed camera motion and overlay/GIF/Export z-index remain unchanged.

### 9. Shortcut Reference

Category cards/icons, stronger category/title/description hierarchy and distinct keycaps replace the flat list. Search/filter and Windows/macOS display continue to consume the single command authority in `src/utils/shortcuts.ts`; category decoration does not duplicate shortcut data. Grid rows preserve content height rather than clipping cards. Actual 1280x540 viewport smoke showed a contained, scrollable dialog, zero clipped cards, and two matches for `flip`.

## Accepted behavior and regression policy

Equal horizontal/vertical visual spacing, snapping-off cleanup, group snapping, ROI/crop Clear/Escape/Apply, camera and timeline contracts are retained. Crop implementation was not changed to solve a misunderstood test procedure. No assertion weakening, retry, arbitrary sleep, skip or camera-tolerance widening was used. Obsolete source-text/mock-wiring tests and absence/one-shot UI assumptions were removed instead of re-pinned. The named-sequence drag test now explicitly exits persistent creation with Escape before testing movement.

## Validation ledger

Observed before final browser gate: `npm run check` passed (lint, TypeScript build, unit tests and production build); 173 unit files / 2598 tests passed. `npx tsc --noEmit` and `npm run validate:ograf` passed. Focused Chromium: 99 passed, zero failures, workers 8 / retries 0. Camera worst delta 0.000px and magnification spread 0.00000; deep corner opposite-anchor drift zero. `npm audit --audit-level=low`: zero vulnerabilities. State consistency: PASS, 52 checks. Production build retains its existing large-chunk advisory.

The first full Chromium run had 413 passed / 2 failed: the named-sequence workflow still assumed one-shot drawing and an older manual-QA test asserted that Align Left did not exist. These obsolete workflow assumptions were corrected while retaining geometry assertions. The final complete run passed **415 / 415, zero failed, zero flaky**, in 3.4 minutes with `CI=1 PORT=5017`, Chromium, workers 8, retries 0. `PORT=5017 npm run qa:release` passed 2/2; `PORT=5017 npm run qa:v6` passed 3/3. These gates exercised the working-tree remediation while HEAD was still the starting 784a8c2 revision; the committed code revision is recorded separately below. Release QA only validated exports; it did not publish a release.

Validated code/tests commit: `679f54f30ee172e08b0d0e94b4561f2a74c87a9f`, pushed normally to PR #11 only. CI Pipeline run [38744301819](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/38744301819) completed successfully, including manifest validation, lint, TypeScript, unit/integration tests and production build. The scoped documents-only refresh rides above this tested code; its final head/CI is reported separately on delivery to avoid a self-referential document hash.

## Live and repository incident disclosure

With explicit user approval, live 5173 was frozen at starting head 784a8c2 in a temporary snapshot while remediation and isolated tests ran. Only after the full local gates and code CI succeeded was that listener stopped and the combined worktree started as persistent service `kcs-pr11-final-qa-5173` (service wrapper 45300, actual listener **48984**). HTTP 200; served source includes the affine factory and direct toolbar from the combined worktree. Actual Chromium smoke found the direct buttons, no page errors, and the compact GIF dialog with selectable 120 sampling and Escape dismissal (259.875px height); the editor screenshot was inspected. API 5000 remains listener **2308**, health HTTP 200; it has never been restarted. The final documents commit changes no runtime code.

An affine subagent accidentally wrote canonical `src/utils/matte.ts`, then restored its HEAD bytes, and also performed an unauthorized index refresh. Work stopped and the incident was reported. Canonical HEAD/index/raw/filtered file hashes all match `96d0b4ad2bed3326f8ff4f8e5df552c2ec93a3b5`; content and staged diffs are empty. A user-approved one-file `git add --refresh` did not clear the metadata-only M marker. The user explicitly accepted this exact dirty-STOP exception and approved continuation, with no further canonical/index repair. Canonical main and origin/main remain `8e2df61b899bb06df110475d5cc17521fcf35715`. Do not describe the canonical working tree as clean or untouched. No canonical modification beyond that disclosed incident is authorized.

## User retest

1. Draw three same-type primitives consecutively; Escape exits and each Undo removes one shape.
2. Inspect both panel handles, including while changing timeline height.
3. Open GIF: compact panel, inside click stays, outside/Escape close; select 120 sampling and compare wall-clock duration.
4. Author three Position-only keys on a Rectangle: Rotation/Scale/Opacity stay unkeyed. Add one explicit Rotation key; only Rotation gains that key.
5. Use the direct alignment/center/distribution toolbar icons at normal desktop width.
6. Distribute three unequal/rotated layers horizontally and vertically: equal visual gaps, outer span fixed, one Undo.
7. Rotate/flip/align/distribute/arrange without routine success toasts; blocked/error feedback remains.
8. Inspect Shortcut Reference hierarchy, search, platform keys and short-window scrolling.
9. Inspector no longer has duplicate Add/Remove Keyframe controls; value editing and timeline keyframing still work.
10. Resize a group containing 90-degree and 30-degree children using edges/corners; rotation and opposite anchor remain consistent, Undo/Redo exact.
11. Every X/Y snap has a clear matching guide; unsnap/release clears it.
12. Recheck accepted crop/group/camera/timeline behavior.

Crop to current selection: select one or two shapes, run the command; the stage fits selected visible bounds at the current frame. Crop to visible content: selection is unnecessary; all visible content at the current frame defines the crop. Crop plus animation: animate Position, crop, then scrub; motion remains spatially consistent relative to the new origin. Crop plus group: crop grouped content and check that children do not shift twice and the group structure stays intact.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. Other files retained under `latest/` are historical context or mirrored root documents, not a claim that the earlier aggregation-only record is current. PR #11 remains a manual user-retest gate; no merge or release was performed.

## manifest.txt

# KCS Post-PR14 Docs Sync + SAFE-02 Preflight Manifest

Repository: C:\Users\ertugrul.ak\Desktop\keyframe-character-studio (main at 84ca0ac for this docs-sync round; the N3 code round ran in the isolated standard worktree .worktrees/n3-import-boundary-pr1 from main@f45f8b1)
Lineage: N3 import-boundary track (Track C campaign); SAFE-01 autosave ownership merged earlier as PR #13
Validated code commits: 1605270 (bounded acceptance + sanitizer floor + guards + e2e seed honesty), cf4a4fd (round report)
Code CI: run 38943255178 SUCCESS at cf4a4fd; qa:release exact-SHA gate passed on a fresh build
Integration: PR #14 MERGED into main at 84ca0ac (normal GitHub merge, no squash/rebase/force; post-merge CI run 38948404230 SUCCESS); head branch fix/n3-import-boundary-caps-1 and worktree .worktrees/n3-import-boundary-pr1 RETAINED pending separate cleanup approval; NO RELEASE, NO TAG
N3 PR-1 scope: bounded numeric acceptance at the single import boundary on both document kinds (finite fps 0.5-240, integer totalFrames 10-1200, canvas edges 2-16384 with fractions legal for Lottie, legacy projectResolution numeric edges, legacy numeric-version guard) plus the sanitizeProjectFps round-to-zero floor; 34 new boundary/sanitizer rows and 4 real-hook apply guards (zero setters, no baseline request, tampered-restore refusal); the v51 seed aligned from 1800 to the 1200 the state always applied

Earlier-round provenance retained below (SAFE-01, checkpoint, integration and V3.x rounds) as historical context; their counts and positions predate N3 PR-1.


Scope: main integration of the PR #9/#10/#11 UI lineage, plus the targeted remediation of the regression the merge gate caught (first-paint chrome fade unsettling the timeline's initial layout). The underlying lineages they integrate: first round — generic affine group resizing; canonical property-channel projection; resolved snap/guide geometry; persistent primitive tools; direct toolbar and explicit gap/center naming; compact GIF dialog and duration-preserving 120 sampling; timeline-only keyframing controls; routine success-toast removal; boundary-centred panel handles; category-card Shortcut Reference. V3.6 polish (2026-10-15): armed-draw crosshair cursor; single dock-width token contract (56/304/372); single-close GIF panel with tooltip-carried format facts; documented align/distribute command set and order; free non-uniform corner resize with Shift aspect toggle; focus-visible pointer/keyboard select policy; quiet mode segment; dense one-line shortcut rows; LAN restored-project provenance chip. V3.7 final micro-polish (2026-10-15): announced Align/Center/Distribute/Rotate-Flip band grouping with a four-arrow both-axes Center glyph; compact restrained rail (42px items, 18px icons, one label voice, light active surface + accent bar) and quiet boundary-tab handles of one family; ONE inset focus-visible authority; presentation-only 180ms Edit/Broadcast chrome crossfade (reduced-motion honoured, camera-exact rapid switching); dense single-column Shortcut Reference sheet; GIF control renamed Sampling rate after verifying 0.5s/1s/2s at 120 encode 25/50/100 frames at the 2 cs delay floor with preserved wall-clock duration.

Validation: integration head 73fc000 — TypeScript build and noEmit, lint, npm test (173 files / 2602 tests), production build and validate:ograf passed; timeline-marquee 6/6 twice in isolation (workers 1, retries 0); npm run qa:release passed for the exact candidate SHA; FULL Chromium 436 passed / 0 failed / 0 flaky (workers 8, retries 0, isolated UI 5188 / API 5017; live API 5000 never touched). Same no-weakening policy as earlier rounds: no assertion relax, skip, retry, arbitrary sleep or widened camera tolerance; new permanent pin in src/tests/useBroadcast.test.ts. V3.7 head — unit 173 files / 2601 tests; full Chromium 436 / 0 / 0; state consistency 56 checks; npm audit low 0; pins e2e/micro-polish-v37.spec.ts (8 tests), three 120-sampling browser rows in e2e/gif-export.spec.ts, two GIF delay-floor unit tests. V3.6 round: unit 2599, full Chromium 426 / 0 / 0, pin e2e/ui-polish-v36.spec.ts. First round additionally: focused Chromium 99; full 415 / 0 / 0; qa:release 2; qa:v6 3; exact production OGraf minification and exported-host load exercised.

Checkpoint head ef1d43e (2026-10-16): tsc -b, lint, production build, validate:ograf clean; unit 173 files / 2602 tests (canonical, hardened collector); release gate passed for the exact candidate SHA; FULL Chromium 436 passed / 0 failed / 0 flaky (workers 8, retries 0, isolated config; live API 5000 and canonical-served 5173 never touched); timeline-marquee 6/6 (workers 1, retries 0); state consistency PASS (57 checks); npm audit low 0. Cleanup removed only the three verified-clean, process-free, ref-preserved -omp-* worktrees via git worktree remove; no git clean, no reset, no force, no branch deletion, no user-file moves; research folders preserved.

Live: 5173 now serves the canonical main checkout (documented cutover in this round's report); API 5000 listener 2308, health HTTP 200, never restarted. No release, tag, npm, rebase, force push, branch deletion, dependency, workflow or OMP configuration change.
Canonical sync: main/origin main carry the delivered head. The disclosed metadata-only matte.ts marker was proven content-free (HEAD/index/worktree blob 96d0b4ad2bed3326f8ff4f8e5df552c2ec93a3b5), the stale index was rebuilt from HEAD (metadata-only operation), and the approved fast-forward checkout resolved it; the tracked canonical tree is clean. The untracked EFFECTCRAFT_DEEP_ARCHITECTURE_RESEARCH.md is the user's local file and was not touched.

Current task documents:
- README.md — entry point and record precedence
- OMP_FINAL_RESPONSE.md — complete findings, root causes, fixes, math/timing decisions, validation and retest record, with the N3 PR-1 import-boundary addendum (2026-10-16)
- manifest.txt — provenance and validation summary
- progress_174_combined_pr9_pr10_ui_polish_v36.md — the V3.6 nine-findings remediation record
- progress_175_pr11_final_micro_polish_v37.md — the V3.7 final micro-polish record
- progress_176_main_integration_mode_swap_fix.md — the main integration and mode-swap fade fix record
- progress_177_version_checkpoint_desktop_cleanup.md — the version checkpoint audit and safe desktop cleanup record
- progress_178_restore_undo_s0_baseline.md — the N1 restore/undo record (root reports/ copy; PR #12)
- progress_179_pr12_edge_review.md — the PR #12 edge review record (root reports/ copy)
- progress_180_safe01_autosave_ownership.md — the SAFE-01 four-loss-mode fix, CAS engine and two-tab pins record
- progress_181_n3_import_boundary_pr1.md — the N3 PR-1 bounded numeric acceptance record (seven confirmed findings, both-route policy, red-to-green matrix, apply guards)

Current mirrors of root state documents (re-copied from root after this round):
- CHANGELOG.md
- NEXT_SESSION.md
- PROJECT_STATE.md

Retained historical documents, not changed in this task:
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md
- KCS_RELEASE_CANDIDATE_SUMMARY.md
- progress_165_pre_qa_repository_cleanup.md
- progress_166_manual_qa_round_two_remediation.md
- progress_167_manual_qa_round_three_remediation.md
- progress_168_manual_qa_round_four_remediation.md
- progress_169_manual_qa_round_four_remediation.md
- progress_170_manual_qa_round_four_remediation.md
- progress_171_manual_qa_round_five_remediation.md
- progress_173_camera_transition_blocker_remediation.md

The one-file contains the current remediation record rather than repeating historical reports. A documents-only commit rides above the tested code commit; its own revision/CI is reported on delivery rather than embedding a self-referential hash.

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md.
