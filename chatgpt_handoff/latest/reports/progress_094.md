# Progress 094 — Full OGraf Release Smoke Gate Patch

## Task

Task 5: import/export, OGraf ZIP, generated runtime, and browser release smoke.

## Baseline and Branch

- Baseline `main`: `e449b31`
- Branch: `test/full-release-gate-e2e-smoke`
- Scope: deterministic release-gate runner over existing focused Playwright coverage; no large new suite.

## Implemented

- Added `npm run qa:release`.
- Added `scripts/run-release-gate.mjs`.
- Runner logs the candidate Git SHA, runs `validate:ograf`, then runs the existing OGraf Chromium specs covering package materialization, generated runtime load/update/play, image fetch, ZIP/export behavior, and editor OGraf ZIP download.
- Runner invokes Node directly for Windows portability and propagates child failures.
- Added `KCS_RELEASE_GATE=1` Playwright mode with dedicated port `5189`, isolated server startup, and `reuseExistingServer: false` so the logged SHA cannot silently test an unrelated stale server.
- No browser download/install was required on this workstation.
- CI was not changed to install browsers; the gate remains an explicit local/approved-environment command.

## Validation

- `npm run qa:release`: passed; candidate SHA `e449b31`, 2 Playwright tests passed.
- Independent review: **READY**.

## Contracts and Safety

- OGraf package structure, public controls, Browser ZIP, and generated runtime contracts preserved.
- Existing Playwright specs reused; no flaky broad suite added.
- No release or tag operation performed.
