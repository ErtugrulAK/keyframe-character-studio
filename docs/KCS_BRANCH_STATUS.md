# KCS Branch Status

Tasks 1–6 are integrated into `main@1ad3f60`; Task 7 is the current documentation branch. `without-mask` and the OMP tooling branch remain separate and untouched.

| BRANCH | PURPOSE | STATUS | LATEST KNOWN COMMIT | NEXT ACTION |
|---|---|---|---|---|
| `main` | Protected product baseline | INTEGRATED / RELEASE CONDITIONAL | `1ad3f60` | Complete Task 7, then Task 8 audit |
| `fix/mask-matte-visual-parity` | Mask/matte parity | MERGED / PRESERVED | `6889771` | Keep branch; no deletion |
| `chore/ograf-fixture-schema-ci-gate` | Fixture/schema CI gate | MERGED / PRESERVED | `e449b31` | Keep branch; no deletion |
| `test/full-release-gate-e2e-smoke` | Release smoke gate | MERGED / PRESERVED | `b0d0177` | Keep branch; no deletion |
| `chore/tooling-path-audit-fix` | Local tooling PATH audit | MERGED / PRESERVED | `1ad3f60` | Keep branch; no deletion |
| `without-mask` | Independent historical snapshot | ARCHIVE / PRESERVED | `eb1d9b4` | Leave untouched |

## Protected invariants

`v1.1.0-public-controls` remains unchanged. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged. No release tag was created or moved.

## Security and release state

Tasks 1–6 are validated. SourcePath residual pathname-write TOCTOU and remote schema network availability remain documented warnings. Production release remains conditional on Task 8 and separate explicit approval.
