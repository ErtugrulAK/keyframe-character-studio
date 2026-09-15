# Progress 088 — SourcePath Filesystem Trust Boundary Review

## Task

Task 2: SourcePath and filesystem trust boundary.

## Baseline and Branch

- Baseline `main`: `0b192fb`
- Branch: `fix/sourcepath-filesystem-trust-boundary`
- Patch commit: `7f4fab4` — `fix: harden ograf sourcepath and materialization boundaries`
- Branch was pushed for review.
- Main was not modified or merged.

## Implemented Patch

- Local asset sources are checked with `lstat` and must be regular non-symlink files.
- Output root must be an existing regular directory and not a symlink.
- Output ancestors below the root are checked for symlink/non-directory components.
- Existing output targets are rejected when they are symlinks or non-files.
- Browser ZIP packaging was not changed.
- Existing overwrite behavior for regular output files was preserved.

## Validation

- Focused package/filesystem suite: 4 files, 85 tests passed.
- Full Vitest suite: 101 files, 1492 tests passed.
- `npm ci`: passed; existing blocked `sqlite3@6.0.1` install-script warning remains.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with the existing Fast Refresh warning at `src/context/AnimatorContext.tsx:655`.
- `git diff --check`: passed.

## Independent Review Result

**NOT READY**. The trust-boundary patch must not merge yet.

Blocking findings:

1. Existing symlink/junction/reparse components above `outputDirectory` are not validated. Recursive `mkdir` can follow such a component before the leaf root is checked, allowing writes outside the intended lexical tree.
2. `sourcePath` is validated with `lstat` and then reopened by pathname with `readFile`, leaving a TOCTOU race where the path can be replaced between validation and reading.

The output target sequence has an analogous race under hostile concurrent filesystem mutation. A safe follow-up must define the supported OS-level no-follow/handle-relative behavior rather than claiming complete protection.

## Gate

Task status: **STOPPED AT TASK 2 REVIEW**.

No fast-forward merge, main push, Task 3 start, release, or tag operation was performed. Task 1 remains merged and healthy. Task 2 requires a narrower filesystem design decision or a safe platform-specific implementation before proceeding.

## Safety

No global OMP config, model roles, memory backend, hooks, routing, secrets, Supabase production connection, Strix scan, Skill UI crawl, OCR/model download, release, tag, force push, reset, rebase, normal merge, or branch deletion was performed. `without-mask` was untouched.

## ChatGPT’ye Yüklenecek Dosyalar

- `reports/progress_086.md`
- `reports/progress_087.md`
- `reports/progress_088.md`
- `src/ograf/packageWriter.ts`
- `src/tests/ografPackage.test.ts`
- Task 1 files listed in `reports/progress_087.md`

## Targeted Follow-up — Blockers Addressed

The follow-up patch is complete:

- `eff4c63` — `fix: close sourcepath filesystem trust blockers`
- `sourcePath` now opens once, validates the same `FileHandle` with `handle.stat()`, reads from that handle, and closes it in `finally`.
- Output root creation now walks from the filesystem root one segment at a time, checking every existing/new directory with `lstat` before proceeding.
- Nested output ancestors are created and checked segment-by-segment.
- Existing output targets remain overwritable only when they are regular non-symlink files.
- Symlink source, symlink output root, nested symlink ancestor, and symlink target tests run when the platform permits link creation; all ran successfully on this Windows workstation.

## Updated Review Result

**READY WITH WARNINGS**.

The previous two blockers are closed. Remaining limitation: output writes still use pathname-based `writeFile` after preflight, so a hostile concurrent filesystem mutation can create a residual target TOCTOU window. This is reported honestly and is not claimed as complete OS-level no-follow protection.

Final branch validation:

- Focused package/filesystem suite: 4 files, 88 tests passed.
- Full Vitest suite: 101 files, 1495 tests passed.
- `npm ci`: passed; existing blocked `sqlite3@6.0.1` install-script warning remains.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with the existing Fast Refresh warning at `src/context/AnimatorContext.tsx:655`.
- `git diff --check`: passed.

No main merge or release/tag operation occurred before this follow-up merge gate.
