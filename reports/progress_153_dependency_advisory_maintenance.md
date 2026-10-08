# Progress 153 — Dependency advisory maintenance

Date: 2026-10-08. Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.

`npm audit --audit-level=low` reported five advisories on the clean post-Astra `main` line (3 critical, 1 high, 1 moderate). Four are removed by a bounded change set: three lock refreshes inside the parents' declared semver ranges, plus one scoped override where no range-based fix exists. `npm audit` now reports **0 vulnerabilities**. No direct dependency, script, engine, workflow or application source change is part of this work.

## Baseline

| Field | Value |
|---|---|
| Branch | `main` |
| HEAD / `main` / `origin/main` | `c1e618efdb5fa6ff2268cd2851fbed770280ec19` |
| Working tree | clean; no in-progress Git operation |
| npm / node | 12.0.2 / v24.18.0 |
| Previous main CI | run `37642461107` — success |

## Fresh advisory matrix

Every row was re-derived from the current `npm audit --json` output, `npm ls <pkg> --all` and the published manifests — the earlier names and severities were re-checked, not trusted.

| Advisory | Severity | Installed | Path | Direct? | Prod / dev | Reachable in KCS? | Fix |
|---|---|---|---|---|---|---|---|
| GHSA-pqg4-j6r4-53mv (`shell-quote`) | critical | 1.9.0 | `concurrently@10.0.5` → `shell-quote` | no (parent is dev-only) | dev/build | **NOT REACHABLE UNDER CURRENT CONFIG** (proof below) | `>=1.11.0` |
| GHSA-jqcg-44mw-7w3h (`proxy-addr`) | critical | 2.0.7 | `express@5.2.1` → `proxy-addr` | no | production | **NOT REACHABLE UNDER CURRENT CONFIG** (proof below) | `>=2.0.8` |
| GHSA-68fv-2mgg-jv7q (`source-map-js`) | high | 1.2.1 | `vite@8.3.0` → `postcss` → `source-map-js`; `@vitest/coverage-v8` → `magicast`; `jsdom` → `css-tree` | no | dev/build/test | dev-only consumers; the advisory needs an attacker-controlled source map | `>=1.2.2` |
| GHSA-hrr3-gc8f-f4qj (`fast-uri`) | moderate | 3.1.7 | `ajv@8.20.0` → `fast-uri` | no | dev/build | `ajv` is used only by `scripts/validate-ograf-manifest.mjs` against vendored fixtures | `>=3.1.8` |

### Reachability proofs

- **`proxy-addr` (critical).** Express evaluates the proxy chain only in `req.ip` and `req.ips`, which call `proxyaddr(this, trust)` (`node_modules/express/lib/request.js:329,346`). `trust` comes from the `trust proxy` setting, which Express initialises to `false` (`lib/application.js:99`) and only compiles through `app.set('trust proxy', val)` (`lib/application.js:370-371` → `lib/utils.js:213`). A repository-wide search of `server/`, `scripts/` and `src/` finds **no** `trust proxy`, `app.set`, `X-Forwarded`, `req.ip` or `req.ips` usage. With `trust proxy` at its default, `compileTrust(false || [])` builds a trust function that trusts nothing; no address parsing of a forwarded chain happens. Verified live: the API binds `127.0.0.1` only and `/api/health` answers on the loopback interface.
- **`shell-quote` (critical).** The advisory names `quote()`: "command injection via a line terminator in a token after a `{ comment }` token". concurrently's only `quote` import is `dist/lib/command-parser/expand-arguments.js`, whose `ExpandArguments.parse` calls `quote(...)` **only** when `this.additionalArguments.length > 0`, and `ExpandArguments` is pushed onto the parser chain only when the CLI supplies additional arguments (`dist/lib/concurrently.js:34`). The `dev` script is `concurrently "node server/index.js" "vite --host"` — no placeholders (`{1}`, `{@}`, `{*}`) and no trailing arguments — so `quote()` is never called by this repository's tooling. The script's command strings are developer-authored constants, not user input.
- **`source-map-js` (high).** Consumers are `postcss` (through Vite), `magicast` (through the coverage provider) and `css-tree` (through jsdom). All three run in build/test only; the advisory is an event-loop denial of service through indexed source-map section offsets, which requires a hostile source map — none is consumed from an untrusted source.
- **`fast-uri` (moderate).** `ajv`'s only consumer in the repository is the offline OGraf schema validator, which resolves `$id`/`$ref` against vendored, SHA-256-pinned schema documents.

## Chosen remediation

| PACKAGE | FROM | TO | WHY | DIRECT/TRANSITIVE | SEMVER RISK |
|---|---|---|---|---|---|
| proxy-addr | 2.0.7 | 2.0.8 | GHSA-jqcg-44mw-7w3h (critical) | transitive — express declares `^2.0.7` | none: lock refresh inside the declared range |
| source-map-js | 1.2.1 | 1.2.2 | GHSA-68fv-2mgg-jv7q (high) | transitive — postcss / magicast / css-tree declare `^1.2.1` | none: lock refresh inside the declared range |
| fast-uri | 3.1.7 | 3.1.8 | GHSA-hrr3-gc8f-f4qj (moderate) | transitive — ajv declares `^3.0.1` | none: lock refresh inside the declared range |
| shell-quote | 1.9.0 | 1.12.0 | GHSA-pqg4-j6r4-53mv (critical) | transitive — concurrently pins the exact version `1.9.0` | none in code: same `quote`/`parse` exports, no dependencies, same engine range |

### Why the shell-quote fix needs a scoped override

`concurrently@10.0.5` declares `"shell-quote": "1.9.0"` — an **exact** pin, not a range — and 10.0.5 is the newest published release (checked against the registry: the latest version is 10.0.5). So:

- option A (direct compatible bump) — not applicable, the package is transitive;
- option B (transitive resolution via parent bump) — no newer parent exists;
- option C (lock refresh inside the declared range) — impossible against an exact pin;
- option D (override) — the only bounded fix;
- the npm-proposed "fix" is `concurrently@9.2.1`, a **semver-major downgrade** (10 → 9) with real script-behaviour risk, which is not a preferable alternative.

The override is scoped to `concurrently` alone and is provably behaviour-neutral for this repository: the only `quote()` consumer requires additional CLI arguments that KCS never passes, and `shell-quote` 1.11.0/1.12.0 exports the same `quote`/`parse` pair with no dependencies and the same `engines` (`>= 0.4`). It should be removed once concurrently publishes a release that declares `shell-quote >= 1.11.0`.

## Exact changes

`package.json` — one added block, nothing else:

```json
"overrides": {
  "concurrently": {
    "shell-quote": "^1.11.0"
  }
}
```

`package-lock.json` — four version entries and their integrity/resolved hashes (plus the `funding` field npm now records for `proxy-addr@2.0.8`). No package was added or removed; the root `dependencies` (10) and `devDependencies` (21) counts are unchanged; `engines`, `scripts` and `allowScripts` are unchanged.

## Validation

| Command | Result |
|---|---|
| `npm audit --audit-level=low` | **0 vulnerabilities** |
| `npm ls --all` | PASS — no extraneous or missing packages |
| `npx tsc -b --pretty false` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 135 files / 2,055 tests |
| `npm run build` | PASS |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests |
| `npm run qa:v6` | PASS — 3 Chromium tests |
| `npm run check` | PASS |
| `npx playwright test --project=chromium --retries=0` | PASS — 268 tests |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | PASS |

Runtime checks after the install:

- `server/bindHost.js`: default bind resolves to `127.0.0.1` (loopback), `KCS_API_HOST` still the only opt-in.
- `server/corsPolicy.js`: `http://localhost:5173` allowed, an unknown origin refused, no-`Origin` requests allowed — the exact allowlist is unchanged.
- API started on `127.0.0.1:5000` (netstat confirms the loopback address only); `GET /api/health` returned `{"status":"online","service":"Keyframe Studio API","database":"SQLite (Embedded Local DB)"}`.
- `sqlite3` native binding: version 3.52.0, in-memory create/insert/select round-trip returned `{"x":42}`.
- No `trust proxy` state changed (it was never set).

## Commit

`7f1e679` — `chore: remediate dependency advisories`. Pushed normally to `origin/main` (`c1e618e..7f1e679`); no force push.

## Remaining items

None for advisories. Two notes for the future:

1. The `overrides` entry is a temporary bridge; delete it when concurrently declares `shell-quote >= 1.11.0`.
2. `fsevents` (macOS-only, optional) and `sqlite3` are the only packages in the tree with install scripts; the `allowScripts` rule still pins `sqlite3@6.0.1` exactly, and no new install script was introduced.
