# Progress 182 — SAFE-02: Web Locks Around the Autosave Critical Section

## Scope

Close the residual multi-tab race SAFE-01 documented (one synchronous
read-compare-write block per tick is atomic within a tab, but two tabs can
still interleave across macrotasks). SAFE-02 wraps the whole critical section
in the Web Locks API, keyed by the guarded storage key, without changing any
SAFE-01 ownership or pause semantics.

## What shipped

- `AUTOSAVE_LOCK_NAME = kcs-autosave:<AUTOSAVE_STORAGE_KEY>` (`constants.ts`):
  the lock is namespaced by the key it guards.
- `useSerialization.ts`:
  - `casWrite(force)` — the SAFE-01 read-compare-write extracted verbatim in
    behavior (idle guard re-runs under the grant, conflict pause, honest
    failure) so it can execute inside exactly one lock grant.
  - `runWithAutosaveLock(task, 'try' | 'queue', signal?)` — structural
    `navigator.locks` detection (no React, no polyfill). Without Web Locks the
    task runs directly: the exact SAFE-01 synchronous window, unchanged
    (jsdom and every non-Chromium runtime keep the old path).
  - Interval tick: `'try'` mode. A busy lock skips the tick — no token
    advances, no queue; the next interval re-observes reality.
  - Manual save: single-flight queue (`manualPendingRef` — the grant
    re-serializes state, so one pending intent always saves the latest
    document; extra clicks add nothing) with a 1000 ms bounded wait
    (`AbortController` + timer). A timeout writes nothing, keeps edits,
    records `manualSaveRejectedAt`, and is NOT a conflict pause.
  - `resetProject`: key removal joins the same critical section (queued,
    unbounded — a replaced document must never be resurrected by a skipped
    removal); ownership finalization moved to after the grant. A new
    `settleEpoch` state bump re-arms the settle effect when finalization
    happens outside a render commit (async path), matching the synchronous
    fallback's baseline capture exactly.
  - Unmount now aborts a queued manual/reset request and neutralizes late
    continuations (`unmountedRef` re-armed at effect setup — a DEV StrictMode
    cleanup from the discarded first mount must not poison the live session).
- Tests: `L1`–`L11` unit series (deterministic in-process lock stub with real
  Chromium fidelity: `ifAvailable` contention hands the callback `null`, not
  `undefined`) and `e2e/autosave-web-lock-contention.spec.ts` (W1/W2) driving
  two real Chromium pages, holding the lock from the second tab via the
  browser's own lock manager — no production test seams.


  - `UseSerializationApi.manualSaveRejectedAt: number | null` (public, additive)
    + `AnimatorContext` pass-through + one `info`-toast per event in
    `HeaderBar` ("Save deferred" / "Save not completed…"). Deliberately distinct
    from the `error` conflict-pause toast.

## The manual-save contract change (and the e2e fleet it broke)

`triggerManualSave` was synchronous end to end under SAFE-01 (the click
handler returned only after `setItem` had landed). The Web Locks API has no
synchronous grant: even an uncontended request resolves its callback on a
later task. Nineteen e2e helpers across fifteen spec files encoded the old
contract — `badge.click()` immediately followed by a raw `localStorage`
read — and started returning the pre-write document (deterministic 15-test
failure under `CI=1` with retries exhausted: authoring-toolbar,
authoring-ux-interactions, corner-anchor-resize).

The fix is a new observable truth rather than a weaker wait: the badge now
carries `data-last-saved-at` (the React state timestamp, surfaced as a data
attribute, not a test-only seam), and every helper waits for that clock to
advance past its pre-click value before reading storage. The 'Just saved'
text wait used by `layer-binding.saveNow` stays — but alone it was never
sound: a restored session boots with a fresh `lastSavedAt`, so the text can
be true with no write at all. The clock advance is the first signal that is
causally tied to the click.

Content-poll helpers (m23-m25, shape-appearance, interactive-shape-creation)
were already race-safe against the async write; they received the clock wait
too, so a silent manual save cannot hide behind a passing content poll.

## Production bugs found by the browser (not by the stub-faithful unit run)

1. **`ifAvailable` lock handoff**: Chromium's `LockManager.request(…, {
   ifAvailable: true }, cb)` invokes `cb(null)` on contention; the first
   implementation checked `lock === undefined` and therefore wrote INSIDE the
   foreign holder's tenure. Live stack capture (`SPYWRITE` under `query().held
   === true`) plus a `request` monkey-patch (`gotLock=false` yet a write
   landed) pinpointed it; the unit suite passed because the stub called back
   with `undefined`. Fixed to a truthy check, and the stub now mirrors
   Chromium (`cb(null)`), turning L4 into the regression pin for the old code.
2. **StrictMode unmount poisoning**: the unmount effect's cleanup set
   `unmountedRef = true` during DEV's double-invoked mount, and nothing reset
   it on the real mount — `manualSaveRejectedAt` never reached state, so the
   deferred-save toast was dead in DEV (the prod build would have worked, but
   QA runs the dev server). Fixed by re-arming the flag in effect setup.

## Environment incident (unrelated to the change)

During this task an external process reverted working-tree files to
`HEAD` twice (12:49 test file + hook; 13:22 `HeaderBar.tsx`), and reappeared
`.worktrees/pr12-final-qa` which the earlier prune had shown as gone. All
SAFE-02 files were rebuilt and are now staged plus backed up outside the repo
(`Desktop/safe02-backup/`). This remains unexplained; worth watching.

## Validation

- Unit: `autosaveMultiTab.test.tsx` 21/21 (SAFE-01's nine intact + SAFE-02's
  twelve).
- Full vitest: 2677 passed / 176 files (no regressions).
- `tsc --noEmit`, `oxlint`, `npm run build`, `npm run validate:ograf`: clean.
- Chromium e2e: contention specs W1/W2 green first try (workers=1); the 15-test deterministic red cluster
  (authoring-toolbar, authoring-ux-interactions, corner-anchor-resize) green at the
  same run; the full suite on the fixed tree: 437 passed + 2 flaky
  (boolean-text-operands :223/:252 — a pre-existing font/box-timing flake family,
  green under isolated repeats; history-restore clean) — release gate result at the
  bottom of this report.
