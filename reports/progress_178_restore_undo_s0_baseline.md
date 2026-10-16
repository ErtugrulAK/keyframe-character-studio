# Progress 178 — N1 Restore/Undo S0 Baseline Fix — 2026-10-16

Branch `fix/restore-undo-s0-seeding` (worktree `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\.worktrees\restore-undo-s0`, from `origin/main` at `643482f`). One task, test-first. **NO MERGE / NO TAG / NO RELEASE / NO PUBLISH**; PR: https://github.com/ErtugrulAK/keyframe-character-studio/pull/12.

## The defect (independently reproduced before any edit)

The research harness `.research/revalidation/scripts/s0-regression.mjs` (run against an isolated `vite preview` of the starting head, ephemeral browser storage only) reproduced 3/3 at `643482f` (exit 1):

* Probe A — restored 10-part scene, ZERO user edits, one Ctrl+Z: **10 → 0 parts** (the project appears emptied; redo recovered it only until the next edit overwrote the redo stack).
* Probe C — one tool-created shape, one Ctrl+Z: 10 → 11 → **0**.
* Probe B (one keyframe drag) survived only because its batch entry kept the index above the empty floor.

## Root cause (measured, not inferred)

`useHistory`'s recording effect seeds S0 from the live document on mount — at that moment the EMPTY default document (`src/hooks/useHistory.ts`, the record-effect block). The startup autosave restore in `useSerialization` (initial-load effect, scene and legacy branches) then applies its setters, so the restored document is appended as the FIRST undo entry: `history = [empty, restored]`, `index = 1`. `canUndo` is therefore true with zero user edits, and undo #1 lands on the empty mount-time snapshot. The restore is INITIALIZATION and was entering history as if it were a user edit.

## The fix (minimal, one authority)

* `useHistory` gains `requestBaselineReset()` — a one-shot request (ref + token state so the recording effect is guaranteed a run even after a no-op apply). The recording effect consumes one pending request on its next commit and replaces the whole stack with `history = [liveDocumentSnapshot]`, `index = 0`, redo cleared. The provisional mount-time S0 remains the floor for the default document; batch/dedup/undo-transaction semantics (§16) untouched.
* `useSerialization` gains the optional `requestHistoryBaseline` prop (module-level stable default; a per-render inline default would have re-armed the one-shot sync every render — caught by the jsdom harness loop). Both successful restore branches call it exactly once, in the same batch as their setters; refused/corrupted restores call nothing (the empty default correctly stays the baseline). The scene branch now honors the previously ignored `fromSceneData` boolean.
* `AnimatorContext` wires the two: `requestHistoryBaseline: requestBaselineReset`. No second history store, no serializer, no replay engine, no timers.

## Contract decisions (edge cases pinned)

* Import and Reset stay documented single-undo-entry USER actions — the fix touches neither (`importProject`/`resetProject` call no baseline request; the F2 browser + hook cases pin undoability).
* StrictMode double mount is idempotent (one consumed request, replace-not-append); the async apply-failure path never consumes a stale request (the token bump rides the same batch as the setters).
* Undo/redo ladder floors AT the restored scene; redo replays only user actions; editing after undo discards the redo branch as before.

## Tests added (red before, green after)

* `src/tests/historyRestoreBaseline.test.tsx` — 9 cases (A zero-edit Ctrl+Z inert; B one edit ↔ restored scene + redo; C ladder floors at baseline with redo order; D redo-branch discard; E one batched gesture = one entry; F1 corrupted autosave refused, empty baseline; F2 import stays undoable; G StrictMode idempotence; H restored semantic parity incl. parentId, textValue, channel key ids). Before the fix: 7 failed / 2 passed. After: 9/9.
* `e2e/history-restore.spec.ts` — 4 real-browser cases (zero-edit Ctrl+Z, keyframe-drag undo/redo against a geometry signature, tool-created-shape undo/redo, import-contrast undoability). Before: 2 failed. After: 4/4.
* Independent harness after the fix (same script, fixed production bundle on isolated :4179): **0/3 repro, exit 0**, A 10→10, C 10→11→10.

## Validation ledger (branch head `68f6213c9576cf173fd37fb2246bed68d0cd8cbe`)

* tsc `-b --pretty false`, oxlint, production build: clean. `git diff --check`: clean.
* Unit: 174 files / **2611 tests** passed (2602 + the 9 new pins). `validate:ograf` valid. State consistency: PASS (60 checks). `npm audit --audit-level=low`: 0 vulnerabilities.
* `qa:release`: **Release gate passed for candidate SHA 68f6213…** (2/2). `qa:v6`: 3/3.
* FULL Chromium (isolated ports, workers 8, retries 0): **440 passed / 0 failed / 0 flaky** (436 + the 4 new pins). No retries, sleeps, skips, or tolerance changes anywhere.
* Surfaces: API 5000 and the live QA UI 5173 untouched; all test traffic on isolated ports (preview :4179, QA UI/webServer per config). The research corpus under `.research/` was read-only; the reproduction ran from a worktree-local copy (kept for review at `.worktrees/restore-undo-s0/n1-repro-tmp/`, git-ignored).
* Self-review sweep: history seed/restore paths (only the startup restore calls the baseline), cross-tab autosave (storage read at mount only), template/sequence switching, clipboard/paste, persistent drawing commits, shortcut semantics, batch-end vs. race windows — no stale-closure or double-seed exposure found.

## Verdict

N1 fixed at the single history authority with red→green evidence on three independent surfaces (hook tests, browser pins, the research harness). Awaiting user QA / PR review; merging, tagging and releasing stay separate decisions.
