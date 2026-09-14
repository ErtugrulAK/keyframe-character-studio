# KCS `without-mask` Branch Audit

## Scope

Read-only inspection performed from `main` on 2026-09-14. No checkout of `without-mask`, deletion, merge, cherry-pick, source change, package change, tag change, or OMP configuration change was performed.

## Branch identity

- Remote ref: `origin/without-mask`
- Tip: `eb1d9b4` — `chore: add without-mask project variant`
- Author/date: Ertuğrul Ak, 2026-08-20 17:07:21 +0300
- Tip parent: none; this is a root commit.
- `git rev-list --left-right --count main...origin/without-mask`: unavailable because there is no merge base.
- `git merge-base main origin/without-mask`: none.
- `origin/without-mask` is not an ancestor of `main`.
- `main` is not an ancestor of `origin/without-mask`.

## Content findings

`without-mask` is a complete, independent KCS project snapshot, not a feature branch based on the released product line. The tip contains 271 tracked paths, including:

- product source under `src/`, tests, `e2e/`, and `server/`;
- independent `package.json` and `package-lock.json`;
- SQLite database artifacts under `server/db/`;
- documentation and screenshots under `docs/`;
- a large `wiki/` knowledge and asset corpus, including PNG and XLSX files;
- its own `.agents/` policy and workflow files.

The branch README describes a React 19 / TypeScript 6 / Vite 8 / Express / PostgreSQL / SQLite motion-graphics studio. The package manifest is an independent application manifest with its own scripts and dependency set. The tip commit is the only commit on this root line.

This is therefore a standalone historical/project-variant snapshot. It is not a safe source-level delta against current `main`, and no selected file import is justified by this audit alone.

## GitHub references

`gh` was available and authenticated. The following returned no results:

- all PRs with head `without-mask`;
- all issues searched for `without-mask`;
- all PRs searched for `without-mask`.

This is evidence that no current GitHub PR or issue reference was found by these queries; it is not proof that no external reference exists.

## Classification

**ARCHIVE** — leave the remote branch unchanged for historical reference. Do not delete it in this task.

Rationale:

1. The branch is clearly separate and obsolete relative to the released `main` lineage.
2. It contains substantial unique source, tests, documentation, database, and binary/wiki material.
3. It has no merge base with `main`, so ordinary merged-branch safety checks do not apply.
4. No current PR or issue reference was found, but the branch may still preserve useful historical project context.

## Recommended next action

Keep `origin/without-mask` untouched. If repository housekeeping later requires a formal archive, request separate approval for a remote rename to `archive/without-mask` or an external bundle archive. Do not delete, merge, cherry-pick, or import selected files without a new review of the standalone project and explicit approval.

## Protected invariants

- `main` remains `258dda3` and synchronized with `origin/main`.
- `v1.1.0-public-controls` remains unchanged; peeled target is `6351d1a`.
- `memory.backend` remains `mnemopi`.
- OMP model roles and task concurrency remain unchanged.
- No source, package, test, asset, QA, or OMP files were changed by the investigation.
