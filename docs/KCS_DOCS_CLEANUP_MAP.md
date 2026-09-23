# KCS Documentation Cleanup Map

## Live current documents

These are the only documents that describe the current state, and the only ones `node scripts/check-state-consistency.mjs` checks. The list is the authority in that script (`LIVE_DOCUMENTS`); adding a document there is what makes it checked.

1. `PROJECT_STATE.md` — current position, validation status and protected boundaries.
2. `NEXT_SESSION.md` — the exact next action and its approval boundary.
3. `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the milestone map, which milestone is NEXT, and the approval gates.
4. `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md` — the release boundary and the accepted blocker constraints.
5. `docs/README_INDEX.md` — the navigation entry point.
6. `docs/KCS_DOCS_CLEANUP_MAP.md` — this map.

`CHANGELOG.md` is live too, and is checked as a mirrored document rather than for current-state claims: a changelog records what happened, so a past-tense statement in it is history, not drift.

## Historical records

Kept unchanged as the audit trail; none of them is a statement about the current state, and the checker never treats them as one.

- `reports/progress_*.md` — the per-task audit trail.
- `docs/checkpoints/**` — point-in-time snapshots that record their own revision.
- `docs/design/**` and `docs/research/**` — studies and specifications.
- `SESSION.md`, `docs/KCS_CURRENT_STATE.md`, `docs/KCS_OPEN_TASKS.md`, `docs/KCS_BRANCH_STATUS.md` — closed-programme documents, each carrying a historical-record note that names the live set instead.
- `docs/KCS_BRANCH_CONSOLIDATION_PLAN.md`, `docs/KCS_*AUDIT*.md`, `docs/KCS_*CLEANUP*.md`, `docs/KCS_DESKTOP_*`, `docs/OMP_*` — plans and audit results.

## Authoritative documents

- Current product and technical truth: `PROJECT_STATE.md` and `NEXT_SESSION.md`.
- Current milestone position: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`.
- Current release boundary: `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`.
- Current audit trail: `reports/progress_044.md` through the latest report.
- Public-controls contract: `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`.

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
