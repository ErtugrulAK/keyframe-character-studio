# KCS Dependency Advisory Maintenance — 2026-10-08

## Latest approved correction

`npm audit --audit-level=low` reported five advisories on the clean post-Astra `main` line (3 critical, 1 high, 1 moderate). All five are resolved by one bounded commit, `7f1e679 chore: remediate dependency advisories`, and the audit now reports **0 vulnerabilities**.

Three are lock refreshes inside the ranges their parents already declare, so no direct dependency moved: `proxy-addr` 2.0.7 → 2.0.8 (critical, through Express), `source-map-js` 1.2.1 → 1.2.2 (high, through postcss/magicast/css-tree), and `fast-uri` 3.1.7 → 3.1.8 (moderate, through ajv). The fourth, `shell-quote` 1.9.0 → 1.12.0 (critical, through concurrently), needed a scoped `overrides` entry: concurrently pins the exact vulnerable version and has no newer release, so no range-based or parent-bump fix exists, and the alternative npm proposes is a semver-major downgrade of concurrently.

## Evidence

Reachability was proven from code rather than assumed. Express evaluates the proxy chain only in `req.ip`/`req.ips`, and KCS never sets `trust proxy` (Express defaults it to `false`) nor reads either accessor, so the `proxy-addr` parsing path was already unreachable — and is fixed anyway. concurrently's only `quote()` consumer is `ExpandArguments`, which requires additional CLI arguments the `dev` script never passes; `shell-quote` 1.11.0+ exports the same `quote`/`parse` API with no dependencies and the same engine range, so the override cannot change this repository's behaviour.

The full gate is green: `npm ls --all` with no extraneous or missing packages, `npx tsc -b --pretty false`, `npm run lint`, `npm test` (135 files / 2,055 tests), `npm run build`, `npm run validate:ograf`, `npm run qa:release` (2 Chromium), `npm run qa:v6` (3 Chromium), `npm run check`, the full Chromium suite (268 tests with `--retries=0`), the state consistency check, and `git diff --check`. Runtime checks confirm the security posture is unchanged: the API still binds `127.0.0.1` by default, the exact CORS allowlist is unchanged, `/api/health` answers on loopback, and the `sqlite3` native binding round-trips.

## Scope boundaries

No direct dependency, script, engine, workflow or application source change. No new install script; the `allowScripts` rule still pins `sqlite3@6.0.1`. No `npm audit fix` was run. The `overrides` entry is a temporary bridge and should be removed once concurrently declares `shell-quote >= 1.11.0`.

## Release state

H7 remains HOLD. Annotated tag `v1.1.0-rc.1` and the GitHub draft prerelease stay at `46d2a3e`. Publishing, finalizing, or re-tagging requires a new explicit user instruction.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.
