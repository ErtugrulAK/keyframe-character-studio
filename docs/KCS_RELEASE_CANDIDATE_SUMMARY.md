# KCS Release Candidate Summary

## Release boundary

The current product candidate is `integration/v6-ui-ograf-public-controls-rc@0efd64a`, created from `feat/ograf-public-controls-v1@2a6b5dc` and based on `integration/v6-ui-ograf-release-candidate@4e4c269`. Public Controls V1 is accepted for the target host after the second manual QA pass. This document does not authorize a `main` merge.

## Accepted milestones

- V3.4.1: accepted and included in the release-candidate line.
- V3.5: accepted and included in the release-candidate line.
- V3.6: accepted and included in the release-candidate line.
- OGraf Package Export V2: included in the release-candidate line.
- OGraf V2.1 compliance: included in the release-candidate line.
- Host compatibility QA: included in the release-candidate line.
- Public Controls V1: implementation and second target-host QA PASS.

## Public Controls V1

- Text: deterministic visible-layer controls with `headline` compatibility.
- Image: package-relative enum/default values with `logo.png` and `logo_alt.svg`; runtime allow-list enforcement.
- Color: fill/stroke controls with standard `format: color` and OGraf `color-rrggbb` metadata.
- Motion, transform, opacity, trim, mask, and path channels remain authoritative.
- Target host QA: BASIC PASS, ASSET PASS, COMPOSITING PASS.
- KCS Import is not part of this host QA; testing used manifest-rooted OGraf folders.

## Validation status

- AJV manifests: PASS, 3/3.
- TypeScript: PASS.
- Vitest: PASS, 100 files / 1,437 tests.
- Lint: PASS with the existing Fast Refresh warning.
- Build: PASS with the existing chunk-size warning.
- V6 QA: PASS, 3/3.
- Playwright equivalent coverage: PASS, 254/254 via shard 1, shard 2 excluding isolated V-T17, and isolated V-T17.
- Full aggregate Playwright command: exceeds the 600-second command envelope; no test or timeout weakening was introduced.

## Branches

- `main`: protected and untouched.
- `integration/v6-ui-ograf-release-candidate`: product release-candidate baseline at `4e4c269`.
- `integration/v6-ui-ograf-public-controls-rc`: current consolidated integration RC at `0efd64a`.
- `feat/ograf-public-controls-v1`: source feature branch at `2a6b5dc`.
- `chore/omp-kcs-config-optimization`: separate OMP tooling branch; not included by default.

## Known warnings and limitations

- Existing Fast Refresh lint warning in `src/context/AnimatorContext.tsx`.
- Existing Vite chunk-size warning during build.
- Full Playwright aggregate requires a longer command envelope or the documented shard strategy.
- OGraf Package → editable KCS Import remains intentionally unimplemented.
- Native host support for color controls is confirmed by the reported target-host QA, but the fallback metadata remains for compatibility.
- Windows case/device-name hardening and portable-font UX remain follow-up work.

## Release decision

The branch is ready for an explicit release decision. Do not merge or fast-forward `main` until the user separately approves that action.
