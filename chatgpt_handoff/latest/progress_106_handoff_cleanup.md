# Progress 106 — Task 105 Handoff Cleanup, Desktop Staging Cleanup, and Asset Visibility Audit

## Scope

Docs, handoff, and audit only. No source, test, package, or workflow change.

1. Verify that `chatgpt_handoff/latest/` is genuinely clean-refreshed and that its SHA wording distinguishes the Task 105 implementation commit from the current `main` HEAD.
2. Audit and reorganize the desktop staging folder `C:\Users\ertugrul.ak\Desktop\KCS` so it holds only ChatGPT upload files plus the user's own asset folders, with stale items moved (never deleted) into a timestamped archive.
3. Audit why manually copied SVG/image files do not appear in the KCS editor, and produce a safe recommendation without changing code.

## Repo preflight state

- `git status --short --branch`: clean, `## main...origin/main`.
- `git fetch origin --prune`, `git switch main`, `git pull --ff-only origin main`: fast-forward only, already up to date.
- Tag `v1.1.0-rc.1` present, annotated, target `46d2a3e59e065816d972dcd56951803951b577f6` (unchanged).
- No unexpected source, test, package, or workflow changes in the working tree.

## SHA consistency findings

| Meaning | SHA |
|---|---|
| Task 105 implementation/integration commit (fast-forward into `main`) | `9fdbf0fe59c28d3d6f07c8ee37081fc93f2ff6db` |
| Task 105 docs/handoff commit (current `main` = `origin/main` HEAD) | `9f7114877e111527e8757668237e41fde8388a99` |
| `v1.1.0-rc.1` tag target (workflow-tested release code candidate) | `46d2a3e59e065816d972dcd56951803951b577f6` |

Why they differ, verified from `git log --oneline -15`:

- `46d2a3e…` is the workflow-tested *code* candidate the release tag intentionally sits on; later documentation commits must not move it.
- `9fdbf0f…` is where Task 105's implementation became part of `main` (fast-forward, no merge commit).
- `9f71148…` adds docs/handoff-only commits on top of `9fdbf0f…`, so current `main` is newer than the integration commit.

Misleading wording found and corrected (minimal edits only):

- `NEXT_SESSION.md` stated `Checkout: main at 9fdbf0fe…`, which implied the integration commit was current `main`. Now it names `9f71148…` as the checkout/HEAD and states the integration commit separately.
- `PROJECT_STATE.md` said Task 105 "is integrated into main at `9fdbf0fe…`" without noting that current HEAD is newer. Wording now separates the integration commit from the current `main`/`origin/main` HEAD, and the release-smoke row states it was the Task 105 integration commit that was exercised.
- `chatgpt_handoff/latest/manifest.txt` previously reported a single "Main after integration" SHA. The refreshed manifest now reports the current HEAD, the implementation commit, the docs/handoff commits, and the tag target as separate, explicitly labelled fields.

Historical reports were left untouched: `reports/progress_103.md`, `progress_104.md`, and `progress_105.md` describe the state at their own time and are accurate as history.

`docs/KCS_CI_STATUS.md` still reports the release-candidate CI snapshot (101 files / 1,495 tests) because it documents the tag-time CI outcome. It is not in this task's allowed edit list, so it was left unchanged; the refreshed handoff manifest carries the current numbers and labels that document as tag-time context.

## Docs changed or no-op

Changed:

- `NEXT_SESSION.md` — SHA wording corrected.
- `PROJECT_STATE.md` — SHA wording clarified; release-smoke row clarified.
- `chatgpt_handoff/latest/README.md` and `manifest.txt` — refreshed with labelled SHAs, the timestamp note, current validation numbers, and the file inventory.
- `reports/progress_106_handoff_cleanup.md` — this report.

Unchanged (no wording problem found): `docs/KCS_POST_RC_ROADMAP.md`, `README.md`, `CHANGELOG.md`, `docs/KCS_CURRENT_STATE.md`, `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`.

## Repo handoff clean-refresh result

- Target: `chatgpt_handoff/latest/` (path resolved inside the repository root and verified to end with `chatgpt_handoff/latest`).
- All previous children were removed before copying; the folder itself was kept.
- 15 document/workflow files plus 19 flattened Task 105 source and test files were copied (copy, never move), together with the refreshed `README.md` and `manifest.txt`.
- Prior manifest declared 32 files; the refresh now declares 35, so the folder is consistent with its own inventory. No stale file from any earlier bundle remains.
- Timestamps of copied files can appear older than the refresh itself because copies preserve original modification times; timestamps alone do not indicate staleness. This is now stated in the manifest.

## Desktop KCS staging cleanup

Folder audited: `C:\Users\ertugrul.ak\Desktop\KCS` (7 root folders, no hidden entries, no repository metadata).

Kept for ChatGPT upload (freshly copied from the repository handoff):

- `README.md`, `manifest.txt`, `progress_106_handoff_cleanup.md`, `progress_105.md`, `progress_104.md`
- `KCS_POST_RC_ROADMAP.md`, `NEXT_SESSION.md`, `PROJECT_STATE.md`
- `KCS_CURRENT_STATE.md`, `KCS_RELEASE_CANDIDATE_SUMMARY.md`, `KCS_CI_STATUS.md`
- `CHANGELOG.md`, `package.json`, `ci.yml`, `release-smoke.yml`
- 19 flattened source/test copies with the `src__` prefix

Archived (moved, not deleted) into `_archive_before_upload_cleanup_20260916-122257`:

- `kcs-ograf-downstream-qa/` — 2026-09-10 downstream QA bundle (package folders plus three `*-ograf.zip` copies and `font-blocked-diagnostics.json`).
- `kcs-ograf-host-compat-qa/` — 2026-09-11 host-compatibility QA bundle.
- `kcs-ograf-public-controls-qa/` — 2026-09-11 public-controls QA bundle.

User asset / preserved folders left completely untouched:

- `KCS ASSET/` (includes `assets/images/logo.png` and `assets/images/logo_alt.svg`)
- `KCS BASIC/`
- `KCS COMPOSITING/`
- `kcs-safe-backups/` (backup content; never-touch rule, left in place)

Unclear items: none. No stop-and-ask was required.

Note for transparency: `KCS ASSET/assets/images/logo_alt.svg` and `logo.png` match the fixtures written by `scripts/generate-public-controls-qa-assets.mjs`, which creates `assets/images/logo_alt.svg` and patches the ASSET manifest enum plus the runtime `IMAGE_REFERENCES`. They are therefore QA-generated artifacts rather than hand-authored art, but they were preserved regardless, and the lowercase QA folders that produced them were archived rather than deleted.

## Asset visibility audit

Question: the user placed SVG/image files in folders such as `Desktop\KCS\KCS ASSET\assets\images\`, but they never appear in the KCS editor.

Searched locations:

- `Desktop\KCS\KCS ASSET\assets\images\` — `logo.png` (68 bytes), `logo_alt.svg` (334 bytes, QA fixture).
- The same relative layout inside the archived QA bundles (identical fixtures).
- Repository `public/` — only `favicon.svg` and `icons.svg`; no user asset library.
- Repository `src/assets/` — build-time app assets only.
- Backend `server/index.js` — exposes `/api/health`, `/api/projects`, `/api/presets`; no asset or file-system endpoint.
- Project autosave storage — `localStorage` key `SEQUENCER_STUDIO_PRO_V5` (`src/utils/constants.ts`, `src/hooks/useSerialization.ts`).

Searched code terms: `assetCatalog`, `imageUrl`, `updatePartMedia`, `FileReader`, `readAsDataURL`, `accept=`, `custom_image`, `publicImage`, `assets/images`, `localStorage`, `AUTOSAVE_STORAGE_KEY`.

Conclusion — how an image actually becomes visible:

1. `src/components/Toolbar/drawers/MediaDrawer.tsx` is the asset entry point. The hidden input uses `accept="image/*,video/*,.mp4,.webm,.mov"`; selected or dropped files are read with `FileReader.readAsDataURL`, probed with `new Image()` for intrinsic size (falling back to 140×140 when the file reports no dimensions), and added through `addCustomPart('custom_image', name, { imageUrl: dataUrl, width, height })`.
2. `src/components/Canvas/StageCanvas.tsx` also accepts a canvas drop, but it uses `URL.createObjectURL(file)` and then `addCustomPart(...)` or `updatePartMedia(shapeId, url, 'image')`.
3. Nothing in the application scans a folder. There is no filesystem-backed asset library, no dev-server asset directory for user files, and no backend asset endpoint, so a file copied into `Desktop\KCS\...` is invisible to the editor by construction.
4. The project's visible state is autosaved to `localStorage` every 10 seconds. Data URLs produced by the Media drawer persist there; `blob:` URLs produced by a canvas drop are session-scoped and do not survive a page reload.
5. OGraf export consumes only project state (`layer.imageUrl`); `src/ograf/legacyCompatibility.ts` converts same-document `data:`/`blob:` sources into package bytes. The `assets/images/*` files inside an exported package are *outputs* of that flow, never an input library.

SVG specifics: `accept="image/*"` accepts `image/svg+xml`, and the Media drawer's dimension probe falls back to 140×140 when an SVG reports no intrinsic size, so SVG does import and render through the UI path. The generated `logo_alt.svg` carries explicit `width`/`height` attributes, so it would import with correct proportions. SVG is therefore not blocked by format; it is blocked only by the "copy a file into a folder" expectation.

Recommended safe fix (no code change required today):

1. Import assets through the Media drawer (Toolbar → Media → "Select media" or drop files on the dropzone). This is the supported path and it persists with the project.
2. Prefer the Media drawer over a canvas drop when the asset must survive a reload, because the canvas drop stores a session-bound `blob:` URL.
3. Keep the desktop folder purely as a source for importing; the package `assets/images/*` tree is an export output, and editing it does not change what the editor shows.
4. Only if a folder-backed asset library is genuinely wanted (desktop folder auto-discovery) would source changes be needed; that is a separate implementation task and should be requested explicitly.

## Validation

| Check | Result |
|---|---|
| `git diff --check` | PASS |
| `git status --short` before commit | Only `NEXT_SESSION.md`, `PROJECT_STATE.md`, `chatgpt_handoff/latest/**`, `reports/progress_106_handoff_cleanup.md` |
| Source / test / package / workflow changed unexpectedly | NO |
| Tag, draft release, npm | Unchanged |
| Desktop cleanup safety | Archive folder created; target folders verified to exist before each move; user asset and backup folders explicitly protected |

Full Vitest, build, lint, `validate:ograf`, and `qa:release` were not re-run because this task changes documentation and the handoff bundle only; the last verified numbers remain 103 files / 1,557 tests from the Task 105 integration.

## Protected invariants

- Tag `v1.1.0-rc.1` was not moved, recreated, or deleted; target remains `46d2a3e59e065816d972dcd56951803951b577f6`.
- The GitHub release remains an unpublished draft prerelease; no publish, finalize, or edit occurred.
- npm publish was not performed; the package remains private at `1.1.0-rc.1`.
- `without-mask` was not touched; global OMP configuration, model roles, provider mappings, `memory.backend: mnemopi`, and `task.maxConcurrency: 8` were not changed.
- No branch was deleted; `feat/export-diagnostics-ux` is retained.
- No user asset, image, or SVG file was deleted; stale desktop folders were moved into a timestamped archive instead.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics` was not modified.
- No secrets, tokens, or API keys were printed or copied.

## Next task recommendation

Roadmap item 2 remains the next task: the track-matte source selection affordance (`feat/track-matte-source-picker`). This cleanup and audit found no blocker for it. The optional folder-backed asset library idea is a separate candidate that would need its own product decision and prompt.
