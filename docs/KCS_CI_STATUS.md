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

The workflow does not install browsers or run Playwright. The explicit local `npm run qa:release` command runs the isolated Chromium OGraf smoke gate without reusing a stale server.

## Current validation

- Main: `1ad3f60`, synchronized with `origin/main`.
- Full Vitest: PASS — 101 files / 1,495 tests.
- `validate:ograf`: PASS for the committed fixture.
- `qa:release`: PASS — candidate `b0d0177`, 2 tests.
- TypeScript, lint, build, and diff check: PASS with existing warnings.

## Limitations

- OGraf schemas are fetched from official URLs but the complete discovered graph is SHA-256 pinned; network access remains required.
- Playwright CI execution is not enabled because browser installation was not approved/configured.

## Protected invariants

- No secrets, production connection, release tag, branch deletion, force push, reset, or rebase.
- `without-mask` remains untouched.
- `memory.backend: mnemopi`, model roles, task concurrency, and global OMP configuration remain unchanged.
