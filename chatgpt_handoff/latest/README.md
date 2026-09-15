# KCS Final Pre-Release Verification Handoff

## Candidate

- Workflow-tested release code candidate SHA: `46d2a3e59e065816d972dcd56951803951b577f6`
- Final documentation HEAD: docs-only commit after the workflow run
- Package version: private `1.1.0-rc.1`
- Release readiness: READY WITH WARNINGS FOR USER APPROVAL

## Remote release-smoke

- Workflow: `release-smoke.yml`
- Run: `34983770238`
- URL: https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/34983770238
- Candidate SHA: `46d2a3e59e065816d972dcd56951803951b577f6`
- Result: PASS
- Chromium tests: 2 passed

## Scope

This bundle contains the reconciled final candidate documentation and manual Playwright release-smoke evidence. No production release or tag was created.

## Next action

A separate explicit user approval is required before any production release or tag operation. The recommended release/tag target is the workflow-tested code candidate SHA above. The post-pass documentation commit is docs-only.

## Included files

The bundle includes current reports, project/release documents, package metadata, and the manual workflow. See `manifest.txt` for the complete list and reasons.
