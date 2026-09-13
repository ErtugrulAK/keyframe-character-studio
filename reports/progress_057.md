# Progress 057 — Protected Main Integration

## Executive Summary

With explicit user approval for the protected main integration, `main` was fast-forwarded from `8024d4f` to the accepted integration RC tip `111c101`. No merge commit, reset, rebase, force push, branch deletion, or OMP tooling merge was used. Release validation passed on `main`. The full Playwright aggregate remains outside the 600-second command envelope, while the documented shard strategy plus isolated timing-sensitive tests provided equivalent 254/254 coverage.

## Approval boundary

The user explicitly approved the protected `main` integration step. This approval covers the fast-forward integration only. No release tag was created, no branches were deleted, and future tag/checkpoint or branch-cleanup actions require separate approval.

## Source and main state

- Source RC: `integration/v6-ui-ograf-public-controls-rc@111c101`.
- Main before: `8024d4f`.
- Main after fast-forward: `111c101`.
- Operation: fast-forward only.
- `origin/main` was an ancestor of the RC: PASS.
- RC contains the accepted release-candidate ancestry and Public Controls V1 line: PASS.
- Required commits `4e4c269`, `b07941c`, and `48577be` are present in the integrated history: PASS.
- Required QA/report documents are present on the integrated history: PASS.

## Included milestones

- V3.4.1.
- V3.5.
- V3.6 and OGraf Package Export V2.
- OGraf V2.1 compliance.
- Host compatibility.
- Public Controls V1.

## Manual target-host QA

The integrated Public Controls V1 line includes the reported target-host PASS results:

- BASIC: PASS — text changes and PLAY motion.
- ASSET: PASS — image/logo replacement after the alternate-resource fixup.
- COMPOSITING: PASS — color controls after the metadata fixup.

This was manifest-rooted target-host testing, not KCS Import.

## Validation on main

- `git diff --check`: PASS.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with the existing Fast Refresh warning.
- `npm test`: PASS, 100 files / 1,437 tests.
- `npm run build`: PASS with the existing chunk-size warning.
- `npm run qa:v6`: PASS, 3/3.
- `npm run validate:ograf`: PASS, BASIC/ASSET/COMPOSITING 3/3.

## Playwright strategy and result

The full aggregate was not claimed as PASS because it exceeds the 600-second command envelope.

- Shard 1/2: 141 passed.
- Shard 2/2 excluding V-T17: 111 passed; V-H12 failed under parallel screenshot timing after retries.
- Isolated V-H12 with one worker and a 120-second test timeout: 1 passed.
- Isolated V-T17 with one worker and a 120-second test timeout: 1 passed.

Equivalent coverage: PASS, 254/254. No test or global timeout was changed.

## Known warnings

- Existing Fast Refresh lint warning in `src/context/AnimatorContext.tsx`.
- Existing Vite chunk-size warning.
- Full Playwright aggregate exceeds the 600-second command envelope.
- V-H12 is timing-sensitive under parallel execution but passes in isolation.

## Branch safety

- `main` contains the accepted integration RC.
- `integration/v6-ui-ograf-public-controls-rc` remains available and unchanged.
- `feat/ograf-public-controls-v1` remains available and unchanged.
- OMP tooling branch remains separate.
- No branches were deleted.
- No release tag was created.
- `memory.backend` remains `mnemopi`.
- Global OMP configuration, model mappings, `.omp/backups/`, and the read-only corpus remain unchanged.

## Next action

Review the main integration result, then separately approve a release tag/checkpoint and optional branch cleanup plan if desired. No further merge is implied by this report.
