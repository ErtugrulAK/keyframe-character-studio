# KCS GitHub Actions / CI Status

## Current workflow

The checked-in `.github/workflows/ci.yml` runs on pushes to `main`, pull requests, and manual dispatch on Ubuntu with Node 22:

1. checkout and npm cache setup;
2. `npm ci`;
3. `npm run validate:ograf`;
4. `npm run lint`;
5. `npx tsc --noEmit`;
6. `npm test` with the configured memory limit;
7. `npm run build`.

The checked-in `.github/workflows/ci.yml` remains the fast push/PR validation path and does not install browsers. The checked-in `.github/workflows/release-smoke.yml` is the manual browser path: it requires a full candidate SHA, installs Chromium, verifies the resolved checkout, and runs the isolated `npm run qa:release` gate.

## Current validation

- Baseline main/origin-main before blocker work: `449ca898a30442e906b802f9824b2ad1dc278e5e`.
- Blocker branch: `fix/release-readiness-blockers`.
- Full Vitest: PASS — 101 files / 1,495 tests.
- `validate:ograf`: PASS for the committed fixture.
- `qa:release`: PASS — candidate `449ca898a30442e906b802f9824b2ad1dc278e5e`, 2 tests.
- TypeScript, lint, build, and diff check: PASS with existing warnings.

## Limitations

- OGraf schemas are fetched from official URLs but the complete discovered graph is SHA-256 pinned; network access remains required.
- The browser workflow is manual and requires an explicit candidate SHA plus Chromium installation; it is not an automatic push/PR gate.

## Protected invariants

- No secrets, production connection, release tag, branch deletion, force push, reset, or rebase.
- `without-mask` remains untouched.
- `memory.backend: mnemopi`, model roles, task concurrency, and global OMP configuration remain unchanged.
