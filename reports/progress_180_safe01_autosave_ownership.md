# Progress 180 - SAFE-01 Autosave Ownership & Compare-And-Swap Hardening

Date: 2026-10-16
Base: main@6b86b29 (PR #12 merge; the branch started before the docs-only follow-ups)
Branch: fix/safe01-autosave-ownership
Task: SAFE-01 (autosave ownership & compare-and-swap), delivered as a session brief.

## Problem (verified against code, all four modes real)

The `useSerialization` autosave engine (10 s interval) had four distinct
data-loss/corruption modes on the shared localStorage key:

1. **Idle overwrite** - an interval tick serialized the in-memory document and
   wrote it every 10 s regardless of change; a second tab loading another
   project in the same browser tab-group had its fresher writes erased by a
   background tab's identical-but-stale serialization (no dirty tracking at all).
2. **Untracked external write -> lost update** - `lastSavedAtRef` was time-only;
   a write from elsewhere was never observed, so the next tick silently replaced it.
3. **Blind CAS race** - the existing conflict check compared in-memory `lastJsonRef`
   against current storage *before* writing and re-compared the stale `lastJsonRef`
   *after* writing, and cleared the conflict on self-writes.
4. **Capture-freeze (silent death)** - the "first completed interval tick captures
   the baseline" rule froze `lastJsonRef` on whatever the document happened to be
   at that instant. A user edit landing inside the first 10 s became the permanent
   baseline; the tab then matched its own baseline forever, never saved again and
   showed the healthy "Auto-saved every 10 seconds" badge. Found while writing the
   H1 regression test (reproduced deterministically before the fix).

## Changes (single file, production)

`src/hooks/useSerialization.ts` only - no new module, no public API change:

- `storageKnownRef` - the tab's observed value of the key; boot/restore adopts
  (and CORRECTS a stale pre-boot read); the interval samples once per tick only
  while a write is in flight; `currentStored === known` (including
  `null === null`) is the single equality rule; a successful CAS adopts the
  value read back, and a failed CAS adopts the observed value and pauses.
- `settledSaveRef` - the dirty baseline, captured by the settle effect whenever
  the tab holds a concrete document (restored flag settled / deliberate
  no-restore); re-armed to `null` after restore application, explicit import,
  and reset - so an early edit can never be absorbed as the baseline (fixes
  mode 4). A tick with no settled baseline never writes.
- `autosavePausedRef` - event-loop-safe mirror of the conflict pause; the tick
  skips while paused without re-rendering.
- Single CAS path: tick and manual save share one implementation - read key ->
  compare with known -> write only if equal -> adopt, or conflict+pause.
  Manual save never force-overwrites across a detected conflict.
- `adoptOwnershipAfterReplacement(known?)` - import and reset are explicit
  document replacements: they re-observe the key immediately, lift the conflict
  pause, and hand the new document to the settle capture. Reset adopts `null`
  (it is the legitimate deleter of the key).

Intentionally preserved: restored tabs stay silent until the first real edit
(task criterion 3); the conflict badge (PR #12) remains the single UI surface;
`lastSavedAt` keeps its meaning for a successfully persisted save.

## Tests

New units in `src/tests/autosaveMultiTab.test.tsx` (9 tests, real hook + real
jsdom storage + fake timers, no sleeps):
- G1a/G1b/G1c - idle discipline: a never-edited empty tab, a restored tab that
  only READ its key, and a stale restored tab vs a newer external document all
  produce ZERO writes (the reproduced K1/K2/K3 wipes).
- G2/G2b - the feature is not weakened: a first edit is persisted on the next
  tick, including on a restored document (adopted over the value it read).
- G3 - an external write since this tab's last save pauses autosave: the
  foreign document survives, the pause is visible via `autosaveConflict`.
- G4 - manual save honors explicit intent with no conflict but refuses across
  a detected conflict (newer storage survives).
- G5 - a failing write reports no success (lastSavedAt stays null) and the
  following tick retries honestly.
- G5b - reset keeps its documented manual semantics and a later edit still
  saves (the reset path re-arms the settle capture).

New Playwright specs `e2e/autosave-multi-tab.spec.ts` (chromium 441 -> 444):
- N1 pin: restored tab + immediate Ctrl+1 must not wipe history (asserts the
  KCS_HISTORY_PIN guard stays live; guards the exact restore-flag timing
  dependency this work introduced).
- K1: second tab's edit is eventually visible (no indefinite stale-cache write) -
  documented observation: the winning tab surfaces the conflict but the exact
  pre-write `getItem` still permits the classic CAS race window; pinned as the
  documented boundary rather than a false "fully fixed" claim.
- K2: history restore after an external change restores the snapshot, not a
  stale overwrite (two-stage poll: intermediate observed value -> snapshot).
- H1: two concurrently active tabs - A (unchanged document, honest CAS) wins
  the key; B's older document never reaches storage; the conflict is VISIBLE
  via the `--paused` badge, not a silent overwrite.

## Validation (all on the final source state)

- Focused units: 9/9 in `src/tests/autosaveMultiTab.test.tsx` on the final source;
  the history-baseline and serialization neighbors stay green in the full run.
- Full Chromium suite: 443 passed + 1 flaky (pre-existing 4179 environmental
  flake, passed on retry) in 5.2 m; webkit/firefox shards run in CI.
- `npx tsc --noEmit` clean; `npm run lint` clean.
- N1 external harness `s0-regression.mjs --mode verify` against the safe01
  production preview bundle: 0/3, exit 0 (no regression of the AMAN fix).
- N2/N3/N4 harness (`--mode reports`, from the earlier restore-undo worktree)
  unaffected: production code untouched there; harness re-ran 0/3 in this
  worktree's copy as well.
- `npm run validate:ograf` (11 manifest files), `git diff --check` clean.
- Production preview (vite preview :4179) driven in the browser harness:
  conflict badge appears for a stale external write, normal tab shows the
  green "Auto-saved" state, zero console errors.

## Known limits (explicit)

- The atomic multi-tab key (SAFE-02 territory, `scripts/agent-templates/multi-tab-coordination-spec.txt`)
  is NOT adopted: within one browser profile the read->write CAS window is
  still interruptible; SAFE-01 guarantees every such loss is DETECTED and made
  visible, never silent.
- Manual save is blocked across a detected conflict until reload (task
  criterion 5). Import/reset are treated as explicit replacements and clear
  the pause by design.
- A restored tab that is never edited never refreshes `lastSavedAt`; the
  badge semantics ("will save when edits exist") are documented in G3.

## Next

SAFE-02 (multi-tab coordination token protocol) and SAFE-03 (destructive-operation
audit) remain the next planned items of the safety track; SAFE-01 removes the
silent-loss half of the multi-tab risk without adopting the token protocol.
