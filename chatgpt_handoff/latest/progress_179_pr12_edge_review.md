# Progress 179 — PR #12 N1 Final Edge Review (legacy restore + partial failure) — 2026-10-16

Follow-up review of OPEN PR #12 (`fix/restore-undo-s0-seeding`) before the separately-approved merge. Scope: the two residual cases handed over by the independent targeted audit (`.research/targeted-audit/N1_RESTORE_UNDO_REVIEW.md` §7). Test-first, single-model, no subagents. **NO MERGE / NO TAG / NO RELEASE / NO PUBLISH.**

## Preflight facts (measured, not assumed)

Worktree `.worktrees/restore-undo-s0`, branch head at start `6361403` (docs) / code `68f6213`; `origin/main` `643482f` (main untouched); PR #12 `OPEN`, `MERGEABLE`; working tree clean (ignored `n1-repro-tmp/` research copy only). Final branch heads after this review: code `0adec3d42c968148490e93b4e23eccc7091572ef` + e2e pin `cd9c150085dd45264d382da5247a05d0f8454a5c`, docs on top.

## Case A — legacy AnimationProject autosave restore: VERDICT PASS (protection gap closed)

The legacy startup branch of `useSerialization` (restore effect, legacy section) DOES request the same baseline reset as the SceneData v2 path (`requestHistoryBaseline()` as the final statement of the success path) — confirmed in source, and now pinned by tests that were genuinely absent:

* **F3** — valid legacy seed (string `version`, nonempty parts/tracks/channels): `restoredFromLocalStorage` true, full document applied, zero-edit Ctrl+Z inert, one own edit undoes back to EXACTLY the restored content (ids, fps 25, totalFrames 96, resolution 1024×768), redo replays, four extra undos floor at the restored scene and go inert. Passes unchanged at the pre-review head (protection test, no code touched for it).
* **F3b** — StrictMode double mount: no reseed, no duplicated baseline (`tracks` length 1, `canUndo` false).
* **F5** — validator-accepted track WITHOUT `channels`: the legacy migrator injects empty channels (documented behavior) and the restore still floors undo at the restored scene; `importProject` parity asserts the same document is accepted (`ok:true`) by the import path.
* Pinned pre-existing quirk (NOT changed, out of N1): the legacy STARTUP path never restores `sceneTitle` (only import does) — the test documents it (`'Fixture'` stays).

## Case B — accepted restore that throws mid-apply: VERDICT BUG, FIXED (real, not mock)

Audit residual #1 was real on the LEGACY branch: the id sweep (`parsed.tracks.forEach(... t.keyframes?.forEach(k => allIds.push(k.id)))`) and `initializeIdCounter` ran AFTER the document setters were dispatched (lines 499–523 pre-fix), and `validateImportedDocument` explicitly accepts keyframes and tracks without `id` (`legacyKeyframeProblem` requires only `frame`+`transform`; `trackProblem` only `partId`). `initializeIdCounter` then called `id.match(...)` on `undefined` → TypeError thrown with every setter already queued → `restoredFromLocalStorage` stayed false on a FULLY applied document, no baseline was requested, and history kept `[empty, restored]` — the phantom undo-to-empty edge. `migrateTrack` (the local one in `useSerialization`) is total, so the channels-less "migrator crash" variant was NOT real — the F5 expectation was corrected to the true documented behavior instead of manufacturing a defect.

Fix (two files, mirrors the documented `fromSceneData` derive-then-apply order):

* `src/hooks/useSerialization.ts` — legacy startup branch computes `savedResolution`, `migratedTracks`, `savedFps/TotalFrames/At`, the full id sweep and `initializeIdCounter` BEFORE the first setter; from the first setter to `requestHistoryBaseline()` the block is pure dispatch ⇒ restore is all-or-nothing, the baseline request is the final success statement, and a failed restore mutates nothing and never requests a baseline (no stale pending reset).
* `src/utils/idGenerator.ts` — `initializeIdCounter` skips non-string entries (boundary documents legitimately omit ids; the parameter contract is `string[]` and the sweep reads validated-but-opaque JSON). Keeps startup in parity with `importProject`, which never crashed on these documents because it does not call the counter.

The scene branch needed nothing: everything `fromSceneData` can throw is derived before its first setter (documented at its head comment; the boundary refuses post-queue consumption fields via `sceneFieldProblem`). `try/finally` baseline (audit's first proposal) was REJECTED — it would mask inconsistent state; the ordering fix makes the throw-after-mutation class unreachable by construction, pinned by **F4** (validator-accepted id-less document restores fully as the baseline; red before fix: `restoredFromLocalStorage` false + phantom undo).

Refusal contrast stays pinned by the existing **F1** (corrupted autosave → defaults remain baseline, no request, no wipe). Import/reset semantics untouched (**F2** + e2e contrast case + new F5 import-parity assertion). One gesture = one entry (**E**), redo truncation (**D**), default boot (F1 branch) covered.

## Red/green ledger

* Unit `src/tests/historyRestoreBaseline.test.tsx` (jsdom, real hooks, ephemeral storage): before (4 new cases vs unfixed code) — F3 title-expectation iteration + F4 `restoredFromLocalStorage=false` + F5 corrected; post-fix: **13/13** (`npx vitest run src/tests/historyRestoreBaseline.test.tsx`).
* Browser pin `e2e/history-restore.spec.ts`: legacy case (id-less keyframes+channels seeded via `addInitScript`) verified **RED on `68f6213`** (temporary file rollback, 1 failed) and GREEN on the fix — file total **5/5**.
* Independent harness (unmodified `.research` script, fresh worktree copy): `node n1-repro-tmp/scripts/s0-regression.mjs --mode verify --reps 3 --url http://127.0.0.1:4179` against the freshly built production bundle of the exact code SHA — **0/3 repro, exit 0** (A 10→10, B stable, C 10→11→10, 3/3 reps healthy).

## Full validation at final heads

* `0adec3d` (code): lint clean (one warning from the git-ignored research-script copy only), `npx tsc -b --pretty false` OK, full unit **174 files / 2615 tests** (2611 + 4), `npm run build` OK, `npm run validate:ograf` valid, `node scripts/check-state-consistency.mjs` PASS (60), `npm audit --audit-level=low` 0, `git diff --check` clean, `CI=1 PORT=5016 npm run qa:release` **PASS**, `CI=1 PORT=5016 npm run qa:v6` 3/3, s0 verify 0/3 exit 0.
* `cd9c150` (e2e-only; `git diff 0adec3d..HEAD -- src/` EMPTY, so the production-code evidence transfers byte-identically): `npm run qa:release` **Release gate passed for candidate SHA `cd9c150085dd45264d382da5247a05d0f8454a5c`**, FULL Chromium `CI=1 PORT=5016 npx playwright test --project=chromium --workers=8 --retries=0` → **441 passed / 0 failed / 0 flaky** (440 + the new legacy browser case).
* Remote CI: `Build, Lint & Test Verification` success on every pushed head (runs 38885949343, 38886181946, 38890057358; final authoritative watch `RUN_EXIT=0`).
* Isolation: preview :4179 (owned service, stopped after), QA ports per config; 5173 UI and 5000 API never touched; `.research/` corpus read-only; no retries/sleeps/tolerance changes; no force/reset/rebase anywhere.

## Files changed in this review (3 commits)

`src/hooks/useSerialization.ts` (+order/guard comments, reordering), `src/utils/idGenerator.ts` (+5 boundary guard), `src/tests/historyRestoreBaseline.test.tsx` (+rawSeed harness, fps/totalFrames/resolution getters, F3/F3b/F4/F5), `e2e/history-restore.spec.ts` (+legacy browser case), `reports/progress_178…` (previous round), `reports/README.md` (+this round), `reports/progress_179…` (this file). No UI changes, no settings, no generated artifacts, no `main` changes.

## Remaining uncertainty

The post-setter region is now pure dispatch by construction, but future edits that insert computation between the first setter and the baseline request would re-open the class — the invariant lives in the block layout plus the F4/F5 pins; a reviewer reading the legacy branch sees the mirror of the `fromSceneData` comment. The legacy-startup `sceneTitle` gap (and the unused `lastSavedTime`-driven `setLastSavedAt` fallback semantics) are pre-existing serialization-fidelity issues outside N1, deliberately untouched and pinned as-is.

## Verdict

Case A: PASS (already correct at PR head; missing protection tests added — zero production change for it). Case B: BUG FOUND (validator-accepted id-less legacy documents) → FIXED minimally at the two named files → red/green proven on unit + real-browser + independent harness. PR #12 remains OPEN pending separate user approval.
