# Progress 116 — Downstream Folder QA Automation (Milestone E, item 8)

## 1. Scope

Implements the approved item-8 plan from `docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`: a repeatable way to produce and check a clean folder QA copy of an OGraf package — the host import unit — without inventing a host contract, a new exporter, or a fake host wrapper.

## 2. Branch

- `test/ograf-folder-qa-automation`, stacked on `chore/ograf-offline-schema-closure` (item 7), base `main` = `46021eece4714fa8880ae4d3018e8f8f064c3a81`.

## 3. What changed

- **`scripts/generate-ograf-folder-qa.mjs`** — one Node-side tool with two modes:
  - `--package <zip|dir> --out <qa-root>` writes the clean folder copy to `<qa-root>/<folder>` and then verifies what it wrote.
  - `--package <zip|dir> --verify <existing-folder>` verifies an existing copy without writing anything.
  - Both modes read the package from a `.zip` (the editor's output, via the existing `fflate`) or from an extracted directory, exclude QA sidecars (`*.diagnostics.json`) from the copy, validate the manifest by running the existing validator against the copy's own manifest file, verify every package file byte-for-byte on disk (missing, drifted and extra files are all reported), and write a host-limited report.
  - `--name` overrides the folder name, which is otherwise derived with the same policy as the browser-side `sanitizeOGrafId` (`toSafeFolderName`, exported for tests).
  - The QA root is an explicit required argument, and the tool refuses a root that would overwrite the repository; the source package is only read.
- **`src/tests/ografFolderQa.test.ts`** — 8 focused cases: clean copy with the sidecar excluded and full parity in the report; `--verify` passes on an unchanged copy; `--verify` fails on byte drift; `--verify` fails on an extra file; an invalid manifest fails the run while the inspected copy and report still exist; a QA root that would overwrite the repository is refused; an explicit root is required; the folder-name policy matches the package id policy.

No host contract, host profile, exporter, dependency or workflow change: the tool reuses the canonical package layout and the pin-verified offline schema closure from item 7.

## 4. Validation (branch `test/ograf-folder-qa-automation`)

| Check | Command | Result |
|---|---|---|
| Generate | `node scripts/generate-ograf-folder-qa.mjs --package <dir> --out <tmp>/qa` | PASS — clean copy (`assets/`, `graphic.js`, `<name>.ograf.json`, `scene.kcs`), sidecar excluded, report written |
| Verify, unchanged copy | same tool with `--verify <copy>` | PASS — exit 0 |
| Verify, tampered copy | edit one byte in the copy, re-run `--verify` | FAILS — exit 1, `content drift: scene.kcs` |
| Verify, extra file | add a file to the copy, re-run `--verify` | FAILS — exit 1, `extra file in the copy: stray.json` |
| Invalid manifest | package whose manifest is `{"name":"broken"}` | FAILS — exit 1, report records `Result: INVALID` |
| Unsafe root | `--out <repository root>` | REFUSED — exit 1 with an explicit message |
| Focused tests | `npx vitest run src/tests/ografFolderQa.test.ts` | PASS — 8 cases |
| Full suite | `npm test` | PASS — 116 files / 1,716 tests |
| Lint / TypeScript / build | `npm run lint`, `npx tsc --noEmit`, `npm run build` | clean / clean / PASS |
| OGraf validation / release gate | `npm run validate:ograf`, `npm run qa:release` | PASS (offline closure) / PASS — 2 Chromium tests |

## 5. Protected invariants

- The official `OGraf Package`, `OGraf Single File (Legacy)`, JSON export and KCS project export are untouched; the tool only reads a package and writes to an explicitly named QA root.
- No dependency, `package.json`, `package-lock.json` or workflow change.
- The expected QA roots under `Desktop` still do not exist on this machine; verification ran in the system temporary directory, and nothing was written to any user folder.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, global OMP configuration and user folders are unchanged.

## 6. Residual risks

- **No host is executed.** The report states this explicitly; folder parity and manifest validity are proven, host acceptance is not.
- **The sidecar rule is a name pattern** (`*.diagnostics.json`). A future sidecar with a different name would be copied and then reported as an extra file by `--verify` rather than silently ignored.
- **Folder names are sanitized** to a conservative character set, so a package whose display name is non-ASCII gets an ASCII folder name; `--name` overrides it when the host requires something specific.

## 7. Next

- Both Milestone E branches (item 7 and item 8) await the independent review and the user merge decision.
