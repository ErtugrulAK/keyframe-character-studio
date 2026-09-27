# KCS Minimal ChatGPT Upload Bundle — final maintenance reconciliation

This is the clean, task-specific handoff for the five-task post-hold maintenance run. It replaces the previous bundle; it is not an archive.

## Current truth

- `main` contains the five implementation commits through `37904fb`.
- Dialog focus restoration: closed at `5cb8a45`.
- Runtime SQLite repository hygiene: closed at `b3f3c6c`.
- Exact API browser-origin policy: closed at `2a313d7`.
- Oxlint 1.85 adoption: closed at `feca773`.
- TypeScript 7 plus Vitest and coverage-v8 5: closed at `37904fb`.
- Each implementation commit has a green `main` CI run; the latest implementation run is `36315904883`.
- Milestone H remains complete through H6 and H7 remains HOLD. The release tag, draft prerelease, private package version, and npm publication state are unchanged.

## Verification baseline

The TypeScript/Vitest baseline passed a fresh `npm ci`, TypeScript build mode, Oxlint, 128 Vitest files / 1,951 tests, production build, OGraf validation, release QA, export/Lottie/matte browser specs, V6 QA, the combined check, state consistency, `npm audit` with zero vulnerabilities, diff hygiene, and Linux CI.

## Files

- `OMP_FINAL_RESPONSE.md` — maintenance close-out response.
- `progress_150_final_maintenance_reconciliation.md` — durable engineering record.
- `NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`, `CHANGELOG.md` — current mirrored documents.
- `manifest.txt` — bundle inventory and boundaries.
- `README.md` — this guide.

The four mirrored documents are byte-equivalent to their repository sources after CRLF/LF normalization and whole-document trimming.

## Deliberately omitted

Source, tests, package files, workflows, historical reports, binaries, archives, assets, caches, and QA output are not copied. Historical reports remain in `reports/` and were not rewritten or deleted.

Nothing was copied to `C:\Users\ertugrul.ak\Desktop\KCS` or `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
