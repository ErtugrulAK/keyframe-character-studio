# Progress 154 — Exact-SHA Release Smoke Gate

Date: 2026-10-08. Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.

The manual Release Smoke Gate was dispatched against the exact candidate SHA and passed. No tag, release, package or npm action was taken; H7 remains HOLD.

## Candidate identity

| Field | Value |
|---|---|
| **TESTED CODE SHA** | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Workflow | `Release Smoke Gate` (`release-smoke.yml`) |
| Run ID | `37752015020` |
| Run URL | https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/37752015020 |
| Trigger | `workflow_dispatch`, `--ref main`, input `candidate_sha=6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Dispatched at | 2026-10-08T08:45:56Z |
| Finished at | 2026-10-08T08:46:42Z (46 s) |
| Requested SHA | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Actually tested SHA | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Conclusion | **success** |

**Candidate identity rule.** The smoke gate tests a code SHA. This run tested `6c27ef3`. The documentation commit that records this run (`docs: record exact-sha release smoke`) moves the branch tip forward without changing a single source, test, workflow, package or asset byte — the docs-only tip is **not** itself smoke-tested. A future release decision must treat `6c27ef3` as the tested code candidate, and must re-run the gate on any later SHA that changes code.

## Why the workflow is verification-only

`.github/workflows/release-smoke.yml`:

- triggers only on `workflow_dispatch`, with one required string input `candidate_sha`;
- declares `permissions: contents: read` — the job cannot push, tag, or publish a release;
- checks out `ref: ${{ inputs.candidate_sha }}` with `fetch-depth: 1`, so the tested tree is pinned to the exact commit;
- asserts `[[ "$(git rev-parse HEAD)" == "$EXPECTED_SHA" ]]` before doing any work;
- runs `npm ci`, installs Chromium for Playwright, and runs `npm run qa:release`.

No step creates or moves a tag, publishes or finalizes a GitHub release, or runs `npm publish`. `scripts/run-release-gate.mjs` reads `git rev-parse HEAD` for its own candidate banner, validates the OGraf fixture manifest, and runs two Chromium specs — it writes only inside the OS temp directory the interoperability spec creates and removes.

## Dispatch path

```bash
gh workflow run release-smoke.yml \
  --ref main \
  -f candidate_sha=6c27ef35d48d61a5e1163d2c91734c864fcafa01
```

`--ref main` selects the workflow definition at `main`; the tested checkout comes from the `candidate_sha` input, which the workflow pins and then verifies.

## Evidence from the run log

| Evidence | Log line |
|---|---|
| Candidate input received | `EXPECTED_SHA: 6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Runner checkout equals the candidate | the `Verify candidate SHA` assertion passed |
| Candidate banner from the gate itself | `Release gate candidate SHA: 6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| OGraf fixture validation | `fixtures/ograf/minimal.ograf.json: valid OGraf v1 manifest` |
| Chromium specs | `Running 2 tests using 2 workers` → `2 passed (3.3s)` |
| Gate result | `Release gate passed for candidate SHA: 6c27ef35d48d61a5e1163d2c91734c864fcafa01` |

Every job step concluded `success`: `Set up job`, `Checkout candidate`, `Verify candidate SHA`, `Setup Node.js Environment`, `Install Dependencies`, `Install Chromium for Playwright`, `Run Release Smoke Gate`, and the post/complete steps. The run has no uploaded artifacts (the workflow has no artifact step) and only the two pre-existing non-blocking runner annotations (Node 20 deprecation, the `ubuntu-latest` → Ubuntu 26 notice).

## What the smoke gate proves

- The exact candidate `6c27ef3` installs cleanly from its own lockfile on a fresh Ubuntu runner (`npm ci`).
- The OGraf fixture manifest validates offline against the vendored, SHA-256-pinned schema closure.
- A KCS OGraf package compiled and materialized on the runner interoperates with Chromium: the spec serves the package files over an isolated HTTP server and drives the generated runtime (`e2e/ograf-phase2d-interoperability.spec.ts`).
- The real editor exports the current project as an OGraf ZIP through the UI (`e2e/ograf-editor-export.spec.ts`).

## What the smoke gate does not prove

- It is not the full test suite: it does not run the 135 Vitest files or the 268-test Chromium suite. Those ran locally on the same code line and are recorded in `PROJECT_STATE.md`.
- It does not cover the text-Boolean, bonding, Motion Curves, Playfair font-portability or dependency-advisory work beyond what the two OGraf specs touch.
- It does not exercise the REST API, the SQLite binding, or the localhost/CORS posture.
- It does not test any SHA other than the one passed to it — including the docs-only tip created after this run.

## Post-run repository facts

| Check | Result |
|---|---|
| `main` == `origin/main` | yes |
| Working tree | clean |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| Tag `v1.1.0-rc.1` target | `46d2a3e59e065816d972dcd56951803951b577f6` (unchanged) |
| GitHub draft prerelease | unchanged (`v1.1.0-rc.1`, Draft) |
| `package.json` | `1.1.0-rc.1`, `private: true` |
| npm registry | 404 — not published |

## Verdict

**EXACT-SHA RELEASE SMOKE PASSED — READY FOR H7 RELEASE DECISION.**

H7 remains HOLD. Creating or moving a tag, publishing or finalizing the draft release, and npm publication all require a new explicit user instruction.
