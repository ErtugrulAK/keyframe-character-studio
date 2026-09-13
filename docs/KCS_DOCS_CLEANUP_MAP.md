# KCS Documentation Cleanup Map

## Canonical first-read documents

1. `PROJECT_STATE.md` — short current truth, branch, QA state, and protected boundaries.
2. `SESSION.md` — latest implementation and validation session.
3. `NEXT_SESSION.md` — exact next action and approval boundary.
4. `docs/KCS_CURRENT_STATE.md` — consolidated technical state.
5. `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md` — accepted milestones and release boundary.
6. `docs/KCS_BRANCH_STATUS.md` — branch purposes and consolidation status.
7. `docs/KCS_OPEN_TASKS.md` — remaining decisions and follow-up work.
8. `docs/KCS_BRANCH_CONSOLIDATION_PLAN.md` — planning-only branch path.
9. `docs/README_INDEX.md` — navigation index.

## Authoritative documents

- Current product truth: `PROJECT_STATE.md`.
- Current technical truth: `docs/KCS_CURRENT_STATE.md`.
- Current release boundary: `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`.
- Current branch boundary: `docs/KCS_BRANCH_STATUS.md` and `docs/KCS_BRANCH_CONSOLIDATION_PLAN.md`.
- Current audit trail: `reports/progress_044.md` through the latest report.
- Public-controls contract: `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`.
- Desktop cleanup evidence: `docs/KCS_DESKTOP_FOLDER_INVENTORY.md`, `docs/KCS_DESKTOP_FOLDER_CLEANUP_PLAN.md`, and `docs/KCS_DESKTOP_FOLDER_CLEANUP_RESULT.md`.

## Consolidated or superseded navigation

- Earlier milestone reports remain unchanged as historical audit records.
- Earlier current-state and branch-status wording is superseded by the current root and `docs/` summaries; no historical file is deleted.
- `reports/progress_053.md` records the pre-second-QA fixup state.
- `reports/progress_054.md` records AJV and Playwright validation plus subagent fixup.
- `reports/progress_055.md` records the target-host QA PASS and cleanup checkpoint.

## Historical archive

The following remain useful history but are not first-read documents:

- `reports/progress_044.md` through `reports/progress_053.md`.
- `docs/research/` analyses and compatibility audits.
- `docs/design/` specifications, except the current public-controls specification when implementing that contract.
- `docs/omp/` OMP tooling documents, which remain separate from the product release line.

## Preservation rules

- Do not delete historical reports.
- Do not break links or rewrite old reports.
- Keep repository documents in English; external QA instructions may remain in their established language.
- Treat the desktop KCS collection as local evidence, not repository source of truth.
- Keep `main` and the OMP tooling line separate until explicitly approved.
