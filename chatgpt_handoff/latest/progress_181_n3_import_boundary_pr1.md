# Progress 181 - N3 PR-1 Import Boundary Numeric Integrity

Date: 2026-10-16
Base: `main@f45f8b1` (SAFE-01 lineage)
Branch: `fix/n3-import-boundary-caps-1` (worktree `.worktrees/n3-import-boundary-pr1`)
Task: N3 import-boundary hardening, first PR (session brief; plan reconciled
against `.research/n3-import-boundary-preflight/` and
`.research/targeted-audit/N3_IMPORT_BOUNDARY_POLICY.md`, both written at `643482f`
and re-verified at this base).

## Confirmed findings (all re-read first-hand at f45f8b1, not inherited)

1. Scene import accepted `fps: 0.4` — positivity-only rule (`importValidation.ts:543`).
2. `sanitizeProjectFps(0.4)` returned `Math.round(0.4) = 0` (`timebase.ts:42-45`).
3. Playback divided by the zero-derived rate: `frameIntervalMs = 1000 / fps = Infinity`
   and `steps = 0` every tick — the playhead froze with zero diagnostics
   (`usePlayback.ts:71,80`); the export contract (`frameDelayMs = 1000 / fps`)
   would inherit the same poison.
4. `totalFrames >= 1` was accepted at the boundary while the state setter
   silently clamped `Math.max(10, Math.min(1200, Math.round(v)))`
   (`usePlayback.ts:26`) — accepted ≠ applied (1e7 became 1200, 9 became 10,
   60.5 became 61 without one word to the user).
5. Canvas width/height accepted any finite positive number (1e9 flowed to the
   SVG viewBox, stage bounds and the GIF canvas plan).
6. The legacy route had NO numeric policy: `legacyProjectProblem` walked only
   parts + tracks, while `fps`/`totalFrames`/`projectResolution` reached the
   same state via the narrowing helpers.
7. A numeric unsupported version (`{ version: 99, tracks, characterParts }`)
   re-routed through the legacy shape and imported (the version check is
   scene-only).

## Policy implemented (boundary-level, both kinds, refuse-don't-repair)

| Field | Rule | Diagnostic |
|---|---|---|
| `fps` (present) | finite, `0.5 <= fps <= 240` | `KCS_IMPORT_INVALID_TIMELINE` `$.fps` |
| `totalFrames` (present) | finite INTEGER, `10 <= v <= 1200` | `KCS_IMPORT_INVALID_TIMELINE` `$.totalFrames` |
| `width`/`height` (present) | finite, `2 <= v <= 16384`, fractions legal (Lottie maps them) | `KCS_IMPORT_INVALID_CANVAS` `$.width`/`$.height` |
| legacy `projectResolution` | object with present numeric edges carries the same range (`$.projectResolution.<edge>`); a non-object keeps the documented drop-to-default narrowing | `KCS_IMPORT_INVALID_CANVAS` |
| legacy numeric `version` | `typeof version === 'number'` outside `SUPPORTED_SCENE_VERSIONS` refuses | `KCS_IMPORT_UNSUPPORTED_VERSION` `$.version` |
| `sanitizeProjectFps` | `Math.round(value) >= 1 ? rounded : fallback` — defense-in-depth so no positive fraction reaches zero | — |

The ranges mirror what the state already enforces (the [10,1200] clamp, the
24/30/60/120 authored rates, ≤2560 presets) with documented headroom — the
boundary no longer accepts documents the state silently rewrites. Absent
optional fields keep their documented defaults; absence is never a refusal.

Documented tightenings (deliberate, honest, compat-suites green):
- a present NON-numeric `fps`/`totalFrames` on the legacy route (e.g. `"30"`)
  is refused instead of being silently dropped to defaults — same type
  strictness the scene route already had;
- a legacy document whose only flaw is an out-of-range numeric canvas edge now
  refuses instead of silently defaulting the resolution.

## Changed files

- `src/utils/importValidation.ts` — `MIN/MAX_IMPORT_FPS`,
  `MIN/MAX_IMPORT_TOTAL_FRAMES`, `MIN/MAX_IMPORT_CANVAS_EDGE`; shared
  `timelineProblem` + `canvasEdgeProblem` applied to BOTH semantic passes;
  legacy numeric-version guard.
- `src/utils/timebase.ts` — `sanitizeProjectFps` round-to-zero floor.
- `src/tests/importValidation.test.ts` — +30 rows/its: the refusal matrix
  (0.4/0.49/240.5/1e9/1e999 fps; 9/1201/1e7/60.5 totalFrames; 1/16385/1e9
  canvas; the same classes on the legacy route; R02 version bypass), the
  accept guards (0.5/29.97/240; 10/1200; 2/1920.5/16384; absent fields;
  compatible legacy documents incl. text-version and junk-object resolution),
  and exactly-one-error-diagnostic.
- `src/tests/projectTimebase.test.ts` — sanitizer pins (0.4/0.49 → fallback —
  THE freeze pin; 0.5/1.4 → 1; 29.97 → 30; 24/240 unchanged; 0/−5/NaN/∞ → fallback).
- `src/tests/n3ImportApplyGuard.test.tsx` (new, 4) — the apply-side contract
  against the real hook: a refused document fires ZERO state setters and never
  re-requests the history baseline (T11/T11b); a tampered autosave (fps 0.4)
  is refused at restore, the session keeps defaults and the storage bytes stay
  untouched (T12); a legitimate autosave still restores normally (T12b,
  no-over-refusal guard).
- `e2e/v51-recovery.spec.ts` — seed `totalFrames: 1800 → 1200`. This was not
  an assertion change: 1800 was NEVER applied (the state clamped it to 1200);
  the old boundary silently accepted the lie and the spec ran on the clamped
  value. 1200 is the exact ceiling and the identical effective value.

## Test-first evidence

RED (before the production change, on the new base): 25 new assertions failed
— every refusal row, the sanitizer pin (`sanitizeProjectFps(0.4)` returned 0),
and all four apply-guard tests (fps 0.4 restored; 1e9 canvas applied state).
GREEN after: the focused five-file run and the full suites below.

## Validation ledger (final tree state)

- lint clean; `tsc --noEmit` clean; production build clean (464ms).
- Full vitest: **176 files / 2665 tests passed** (+41 new).
- Full Chromium: **443 passed + 1 flaky** — the flake was
  `e2e/history-restore.spec.ts` explicit-import-transaction under workers-4
  CPU contention; it passed on the run's own retry and 5/5 in isolation
  (`--workers=1 --retries=0`), and every seed value in that file is inside the
  policy (fps 30, 90 frames, ≤1920) — environmental, not production.
- `npm run validate:ograf` clean; `git diff --check` clean.
- `npm run qa:release` passed for the exact pushed candidate SHA (fresh build).
- PR CI (Build, Lint & Test Verification) verified green at the pushed SHA.
- Protected surfaces untouched throughout: canonical `main` checkout, 5173,
  API 5000, 4312 (never started, never needed), all `.research/` folders,
  previous worktrees, `EFFECTCRAFT_DEEP_ARCHITECTURE_RESEARCH.md`.

## Compatibility and unresolved risks

- Existing supported rates (24/30/60/120), 29.97-style fractions, presets,
  the compatibility-matrix fixtures and editor round-trips stay accepted —
  proven by the unmodified compat suites.
- A real file authored by an OLDER build with a >1200 timeline (not producible
  by this editor, whose own setter clamps) would now refuse with a clear
  diagnostic instead of silently truncating; that is the accepted trade of
  refuse-don't-repair. Revert lever: widen the two `MAX_IMPORT_*` constants.
- The read-side narrowing helpers (`readOptionalNumber`,
  `readProjectResolution`) are intentionally untouched — the boundary is the
  single policy authority (AGENTS one-authority rule).
- Deferred by plan (not this PR): keyframe frame-range + id uniqueness (C4),
  canvas JSON-drop choke (C5), media size caps (C6), channel-key allowlist
  (C8), FileReader pre-check (C9), id hygiene (C11), preset-library read
  (C12) — the audit's backlog order stands.

## Handoff

One-file for ChatGPT upload:
`chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` (regenerated, checker-enforced sync).
No merge, no release, no tag — the PR waits for the user's review.
