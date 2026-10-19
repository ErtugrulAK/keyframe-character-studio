# Chromium Smoke Workflow

`.github/workflows/chromium-smoke.yml` is a lightweight, **nonblocking** browser
smoke over a small set of known-stable Chromium specs. It complements — it does
not replace — the two existing jobs:

- **CI Pipeline** (`.github/workflows/ci.yml`): static analysis, unit tests and
  the production build on every push/PR. No browser run.
- **Release Smoke Gate** (`.github/workflows/release-smoke.yml`): the full
  exact-SHA release gate (`npm run qa:release`). Manual only, blocking by
  design.

## Behaviour

- Triggers: manual dispatch and a weekly schedule (Mondays 04:27 UTC).
  It is not attached to PRs and no branch-protection rule references it.
- Browser: Chromium installed from the lockfile-pinned Playwright version, so
  the browser build changes only when `package-lock.json` changes.
- Ports: runs with `CI=1`, which makes `playwright.config.ts` bind vite and the
  API to the isolated QA ports (`127.0.0.1:5188`) and refuse to reuse an
  existing server. No interference with any other job or checkout.
- Bounds: step timeout 15 minutes, `--workers=2`, job timeout 20 minutes.
- Failure evidence: Playwright traces (`on-first-retry`) and the HTML report
  are uploaded as the `chromium-smoke-artifacts` artifact for 7 days.

## Spec selection

The set favours specs that (a) cover load-bearing product surfaces and (b) have
been green through repeated isolated runs:

| Spec | Surface |
| --- | --- |
| `e2e/ograf-phase2d-interoperability.spec.ts` | OGraf import/export round-trip (also in the release gate) |
| `e2e/ograf-editor-export.spec.ts` | Editor → OGraf package export (also in the release gate) |
| `e2e/gif-export.spec.ts` | Lazy GIF panel, encoder output read back with an independent GIF parser, chunk failure/recovery |
| `e2e/k1-property-animation.spec.ts` | Property keyframe animation through the emitted runtime |

Known-flaky cases are not hidden from the full release gate: this workflow is
an additive signal only, and `npm run qa:release` continues to run the complete
gate unchanged.

## Extending

Add a spec only if it is stable across repeated isolated runs
(`npx playwright test <spec> --workers=1`, several consecutive green runs) and
keeps the step inside its time bound. Flaky findings go through the normal
root-cause process first; do not paper over them with retries here.
