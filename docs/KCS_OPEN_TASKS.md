# KCS Open Tasks

## Completed roadmap tasks

- Tasks 1–6 are complete and merged into `main`.
- Evidence: `reports/progress_086.md` through `reports/progress_096.md`.
- `without-mask` remains an untouched archive candidate.

## Current release state

- Main baseline: `main@1ad3f60`.
- `validate:ograf`: deterministic fixture gate active; remote schema bytes are hash-pinned but network access remains required.
- `qa:release`: isolated Chromium smoke gate active.
- Production release remains HOLD pending Task 8.

## Remaining roadmap

### Task 7 — Current-state documentation reconciliation

Update living documentation only; historical reports remain unchanged.

### Task 8 — Release-readiness decision audit

Audit only. No tag, release, version bump, or branch deletion. Separate explicit user approval is required for any release/tag operation.

## Global tooling state

- MarkItDown and Strix are installed in the uv tool inventory but are not available through the current PATH.
- Skill UI was not found in PATH or the uv tool inventory.
- Strix scan and Skill UI crawl/init remain gated and were not run.
- `memory.backend: mnemopi`, model roles, task concurrency, and global OMP configuration remain unchanged.

## Invariants

- Preserve standard OGraf export, browser ZIP, legacy single-file export, KCS project export, and KCS Import behavior.
- Keep `origin/without-mask` untouched.
- Do not create or move release tags.
