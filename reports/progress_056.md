# Progress 056 — Public Controls Integration RC

## Executive Summary

The approved integration-only consolidation was completed without modifying `main`. A new branch, `integration/v6-ui-ograf-public-controls-rc`, was created directly from the accepted `feat/ograf-public-controls-v1` tip at `2a6b5dc`. The new branch contains both the release-candidate ancestry and the accepted Public Controls V1 line.

## Approval boundary

User approval covers integration RC creation/update only. It does not authorize a `main` merge, branch deletion, force push, reset, rebase, or history rewrite. `main` remains untouched.

## Branch operation

- Source: `feat/ograf-public-controls-v1` at `2a6b5dc`.
- Base/reference: `origin/integration/v6-ui-ograf-release-candidate` at `4e4c269`.
- Target: `integration/v6-ui-ograf-public-controls-rc`.
- Operation: new local branch created from `origin/feat/ograf-public-controls-v1`.
- Target HEAD after creation: `2a6b5dc`.
- No normal merge commit, reset, rebase, or force operation was used.

## Ancestry verification

- `origin/integration/v6-ui-ograf-release-candidate` is an ancestor of target HEAD: PASS.
- `origin/feat/ograf-public-controls-v1` is an ancestor of target HEAD: PASS.
- Required source commits `4e4c269`, `b07941c`, and `48577be` are ancestors of the source tip: PASS.

## Included manual QA

The accepted target-host Public Controls V1 results are included:

- BASIC: PASS — text changes and PLAY motion.
- ASSET: PASS — image/logo replacement after the alternate-resource fixup.
- COMPOSITING: PASS — color controls after the metadata fixup.

This remains manifest-rooted target-host testing, not KCS Import.

## Validation

- `git diff --check`: PASS.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with the existing Fast Refresh warning.
- `npm test`: PASS, 100 files / 1,437 tests.
- `npm run build`: PASS with the existing chunk-size warning.
- `npm run qa:v6`: PASS, 3/3.
- `npm run validate:ograf`: PASS, BASIC/ASSET/COMPOSITING 3/3.

## Playwright strategy and result

The full aggregate remains outside the 600-second command envelope. The documented equivalent strategy was run on this integration RC:

- Shard 1/2: 141 passed.
- Shard 2/2 excluding isolated V-T17: 111 passed and one parallel flaky V-H12 result.
- Isolated V-H12 with one worker and a 120-second test timeout: 1 passed.
- Isolated V-T17 with one worker and a 120-second test timeout: 1 passed.

Equivalent coverage is PASS for the full 254-test set. The parallel shard exposed timing sensitivity in screenshot-based reload checks; no test or global timeout was modified.

## Known warnings

- Existing Fast Refresh lint warning in `src/context/AnimatorContext.tsx`.
- Existing Vite chunk-size warning.
- Full Playwright aggregate requires a longer command envelope; shard strategy remains the reliable execution path.
- Playwright shard 2 reported V-H12 as flaky under parallel execution, while isolated execution passed.

## Git summary

- Integration RC final HEAD after documentation commits: `c7f5bb1`.
- Documentation commits: `0efd64a` and `c7f5bb1`.
- `main`: untouched.
- OMP tooling branch: separate.
- `memory.backend`: remains `mnemopi`.
- Global OMP configuration and model mappings: unchanged.
- Integration RC pushed with upstream tracking: complete.

## Next action

Ask for explicit approval before any `main` merge. No release is claimed complete until that separate approval is provided.
