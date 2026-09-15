# Progress 103 — v1.1.0-rc.1 Tag and Draft Release

## Approval

The user explicitly approved release/tag creation: `Release/tag oluşturmayı onaylıyorum.`

## Tag

- Tag: `v1.1.0-rc.1`
- Tag target SHA: `46d2a3e59e065816d972dcd56951803951b577f6`
- Tag type: annotated
- Tag pushed: PASS
- Tag is not moved or deleted.

## GitHub release

- Created: YES
- Type: draft prerelease
- URL: https://github.com/ErtugrulAK/keyframe-character-studio/releases/tag/untagged-aebd4f0694468b7b4920
- npm publish: NO
- Package remains private at `1.1.0-rc.1`.

## Remote smoke

- Workflow: `release-smoke.yml`
- Run ID: `34983770238`
- URL: https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/34983770238
- Candidate SHA: `46d2a3e59e065816d972dcd56951803951b577f6`
- Result: PASS
- Chromium tests: 2 passed

## Validation

- `npm ci`: PASS; existing blocked `sqlite3@6.0.1` install-script warning remains.
- `npm run validate:ograf`: PASS.
- `npm run qa:release`: PASS on current main `8e398dffc79670225a3bed9b1e19258b7b0d5b3f`; 2 Chromium tests passed.
- Full Vitest: PASS; 101 files / 1,495 tests.
- `npm run build`: PASS; existing Vite chunk-size warning remains.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with existing Fast Refresh warning.
- `git diff --check`: PASS.

## Accepted warnings

- Hostile concurrent filesystem mutation is unsupported.
- OGraf schema validation requires network access; offline validation is not claimed.
- Manual browser workflow requires Chromium installation.
- Existing React Fast Refresh, Vite chunk-size, and sqlite install-script warnings remain.

## Safety

- No force push, reset, rebase, normal merge commit, or branch deletion.
- `without-mask` untouched.
- Global OMP configuration, model roles, `memory.backend: mnemopi`, task concurrency, hooks, routing, and secrets unchanged.
- No production stable release and no npm publication.
