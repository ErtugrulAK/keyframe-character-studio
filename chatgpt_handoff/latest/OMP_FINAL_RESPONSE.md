# KCS Milestone E Item 8 — Final Response (Folder QA Automation)

This file is the OMP final response for the item-8 task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** the approved item-8 plan is implemented on branch `test/ograf-folder-qa-automation`, stacked on the item-7 branch (`chore/ograf-offline-schema-closure`), base `main` = `46021eece4714fa8880ae4d3018e8f8f064c3a81`. It awaits the review and the user merge decision.
- **Report:** `reports/progress_116_ograf_folder_qa.md`.

## 2) WHAT CHANGED

`scripts/generate-ograf-folder-qa.mjs` is one Node-side tool with two modes:

- `--package <zip|dir> --out <qa-root>` writes the clean folder QA copy (the host import unit) to `<qa-root>/<folder>` and then verifies what it wrote;
- `--package <zip|dir> --verify <existing-folder>` verifies an existing copy without writing anything.

Both modes read the package from a `.zip` (the editor's output, through the existing `fflate`) or an extracted directory, exclude QA sidecars (`*.diagnostics.json`), validate the manifest by running the existing validator against the copy's own manifest file (offline, pin-verified closure from item 7), compare every file byte-for-byte on disk, and write a host-limited report. The QA root is a required explicit argument; a root that would overwrite the repository is refused; the source package is only read. `toSafeFolderName` mirrors the browser-side `sanitizeOGrafId` policy.

`src/tests/ografFolderQa.test.ts` pins the contract in 8 cases: clean copy with the sidecar excluded and full parity in the report; `--verify` passes unchanged; `--verify` fails on byte drift; `--verify` fails on an extra file; invalid manifest fails the run while the inspected copy and report remain; the repository-overwrite root is refused; an explicit root is required; the folder-name policy matches the package id policy.

No host contract, host profile, exporter, dependency or workflow change.

## 3) VALIDATION

| Check | Result |
|---|---|
| Generate from a package directory | PASS — clean copy (`assets/`, `graphic.js`, `<name>.ograf.json`, `scene.kcs`), sidecar excluded, report written |
| `--verify` on the unchanged copy | PASS — exit 0 |
| `--verify` after editing one byte | FAILS — exit 1, `content drift: scene.kcs` |
| `--verify` after adding a stray file | FAILS — exit 1, `extra file in the copy: stray.json` |
| Invalid manifest package | FAILS — exit 1, report records `Result: INVALID` |
| `--out <repository root>` | REFUSED — exit 1 |
| Focused tests / full suite | PASS — 8 cases / 116 files, 1,716 tests |
| Lint / TypeScript / build / validate:ograf / release gate | clean / clean / PASS / PASS (offline) / PASS (2 Chromium tests) |

## 4) REVIEW

The change goes through the independent read-only review gate before any merge; the verdict is recorded here before the merge request.

## 5) SAFETY

- The official exports are untouched; the tool only reads a package and writes to an explicitly named QA root. No dependency, `package.json`, `package-lock.json` or workflow change.
- The expected QA roots under `Desktop` still do not exist on this machine; verification ran in the system temporary directory. Nothing was written to any user folder.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders: unchanged.

## 6) NEXT

One decision: merge `test/ograf-folder-qa-automation` (and its item-7 base) after the review passes. If no decision is given, nothing merges.
