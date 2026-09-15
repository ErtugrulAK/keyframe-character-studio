# KCS v1.1.0-rc.1 Release Handoff

## Approval

User explicitly approved release/tag creation: `Release/tag oluşturmayı onaylıyorum.`

## Tag / release

- Tag: `v1.1.0-rc.1`
- Tag target SHA: `46d2a3e59e065816d972dcd56951803951b577f6`
- Tag pushed: YES
- GitHub release: draft prerelease
- Release URL: https://github.com/ErtugrulAK/keyframe-character-studio/releases/tag/untagged-aebd4f0694468b7b4920
- npm publish: NO; package remains private

## Remote smoke

- Workflow: `release-smoke.yml`
- Run: `34983770238`
- URL: https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/34983770238
- Candidate SHA: `46d2a3e59e065816d972dcd56951803951b577f6`
- Result: PASS; 2 Chromium tests passed

## Validation

Local validation passed: npm ci, validate:ograf, qa:release, Full Vitest (101 files / 1,495 tests), build, TypeScript, lint, and diff check. Existing non-blocking warnings remain documented.

## Accepted warnings

- Hostile concurrent filesystem mutation is unsupported.
- OGraf schema validation requires network access; offline validation is not claimed.
- Manual browser workflow requires Chromium installation.
- Existing React Fast Refresh, Vite chunk-size, and sqlite install-script warnings remain.

## Next action

The release is a draft prerelease. Publish or finalize the GitHub draft only with a further explicit user instruction. No npm publication was performed.

## Included files

See `manifest.txt` for the complete copied-file list.
