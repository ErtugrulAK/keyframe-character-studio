# KCS Minimal ChatGPT Upload Bundle — Milestone D Item 9 Follow-Up (engines + npm-12 allowScripts)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The `engines` declaration and the npm-12 install-script policy (Milestone D item 9 follow-up), applied on
`chore/engines-allow-scripts` from `main` at `752ca28`:

- `package.json` now declares `engines.node: "^22.22.2 || ^24.15.0 || >=26.0.0"` — the intersection
  required by the locked jsdom/Vite toolchain. CI's Node 22 lane and the local Node 24.18.0 runtime
  remain supported; the advisory range excludes unsupported early Node 22 and odd-major runtimes.
- The npm-12 install-script policy is answered with a **version-pinned approval** for
  `sqlite3@6.0.1` (`allowScripts`), because that package installs by downloading a prebuilt NAPI
  binding and npm 12 blocks the step without an approval, which left a fresh install without the
  binding and the API server without a database driver.
- Proof: deleting `node_modules/sqlite3/build` and running the approved install script restored
  `node_sqlite3.node` from the prebuilt download, the binding loads, and `GET /api/health` returns 200.
- No dependency version, script, workflow or `.npmrc` changed. `package-lock.json` changed only at the
  root `engines` metadata; its dependency graph is unchanged.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_131_engines_allow_scripts.md` — the task record
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone D status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md`
are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after
CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and design files are intentionally omitted (they live in the repository). Flattened
copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also
omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports,
release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.
Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
