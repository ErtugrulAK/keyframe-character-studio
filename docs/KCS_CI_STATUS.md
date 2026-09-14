# KCS GitHub Actions / CI Status

## Audit date and scope

Audited from `main` on 2026-09-14. Scope was GitHub Actions inventory, recent remote run status, local CI reproduction, and safe diagnosis. No product feature work or source-behavior change was performed.

## Workflow inventory

The repository contains one checked-in workflow: `.github/workflows/ci.yml` (`CI Pipeline`). It runs on pushes to `main`, pull requests, and manual dispatch.

The workflow has one Ubuntu job, `Build, Lint & Test Verification`:

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` with Node 22 and npm cache.
3. `npm ci`.
4. `npm run lint`.
5. `npx tsc --noEmit`.
6. `npm test` with `NODE_OPTIONS=--max-old-space-size=4096`.
7. `npm run build`.

There is no Playwright job in the checked-in CI workflow. No workflow timeout or artifact-upload configuration is present. Playwright remains a separate local/release validation concern.

## Remote status

`gh` was authenticated during the prior audit. The last recorded CI run was green:

- Run `34822884119` — `CI Pipeline`, push of `bd41339`, success.
- Job `Build, Lint & Test Verification`: success.
- Main has since received the security-hardening and documentation commits; local validation on the current line remains green.
The preceding runs for `258dda3`, `b51f4f3`, the release tag checkpoint, and earlier main commits are also successful. Two historical failures were inspected:

- Run `33276967365` failed at an old commit because of several stale TypeScript errors and an unused import.
- Run `33187659736` failed at an old commit because of an unused `rotBarLength` variable.

Those errors are absent from current `main` and are not current workflow failures.

## Local reproduction

Using the current checkout and current dependency lock:

- `npm ci`: PASS; existing dependency deprecation/install-script notices only.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with the existing Fast Refresh warning.
- `npm test`: PASS — 101 files, 1,479 tests on main; the isolated guard branch adds three direct malformed-content cases.
- `npm run build`: PASS; existing Vite chunk-size warning only.

The full Playwright aggregate was not rerun because the established release evidence documents that the 254-test aggregate exceeds the command timeout. The checked-in CI workflow does not invoke it. No new e2e failure was reproduced or diagnosed.

## Diagnosis and decision

Current remote CI is green and current local CI-equivalent validation passes. Historical failures are already resolved on `main`; they do not justify a workflow or product-code change. No CI fix is needed in this audit.

A future Playwright CI job may use the already validated shard strategy, but adding or restructuring that job is outside this no-failure audit and was not performed.

## Protected invariants

- No product source, test, package, or workflow file changed.
- No branch or tag was deleted or moved.
- `v1.1.0-public-controls` remains at `6351d1a`.
- `memory.backend: mnemopi`, model roles, and task concurrency remain unchanged.
- No secrets were committed or written.
