# Progress 156 — v1.1.0-rc.2 public prerelease publish

Date: 2026-10-08. Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.

The existing `v1.1.0-rc.2` **draft** prerelease was published as a **public prerelease**. No new tag was created, no release was recreated or retargeted, `v1.1.0-rc.1` is untouched, and no npm publication occurred.

## Candidate identity

| Field | Value |
|---|---|
| **TESTED CODE SHA (candidate)** | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Annotated tag | `v1.1.0-rc.2` — tag object `3d17e584704fcf534f9e885167ad300e904a332f` (unchanged) |
| Tag dereferences to | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` — exact match |
| Release Smoke Gate | run `37752015020` — success, `headSha` = the candidate |
| **CURRENT DOCS TIP** | `f0a34c2eceaaa0f973ed1e0600fe474b2ab6b9a8` before this record; the record commit moves it forward and is **not** smoke-tested |

No source, test, workflow, package, lock or asset byte differs between the candidate and the documentation tip: the only commits after `6c27ef3` are docs-only (`c650da1`, `f0a34c2`), verified with `git diff --name-only 6c27ef3..HEAD` filtered to non-documentation paths (empty).

## Publication

| Field | Value |
|---|---|
| Action | `gh release edit v1.1.0-rc.2 --draft=false --prerelease` |
| Release ID | `RE_kwDOTexJrc4YPnCt` — the **same** release object as the draft (not recreated) |
| Title | `KCS v1.1.0-rc.2` |
| Tag | `v1.1.0-rc.2` |
| `isDraft` | **false** |
| `isPrerelease` | **true** |
| `targetCommitish` | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` (unchanged) |
| `createdAt` | 2026-10-08T11:19:15Z |
| `publishedAt` | 2026-10-08T13:11:16Z |
| Public URL | https://github.com/ErtugrulAK/keyframe-character-studio/releases/tag/v1.1.0-rc.2 (HTTP 200) |

The release is listed as **Pre-release**, not latest-stable. It is not a stable release and no `v1.1.0` release exists.

## Pre-publish state (verified before the mutation)

- `main` == `origin/main` == `f0a34c2eceaaa0f973ed1e0600fe474b2ab6b9a8`; working tree clean; no in-progress Git operation.
- The candidate commit existed locally and was an ancestor of `origin/main`.
- `v1.1.0-rc.2` existed locally and remotely, annotated, dereferencing exactly to the tested SHA.
- `v1.1.0-rc.1` dereferenced exactly to `46d2a3e59e065816d972dcd56951803951b577f6`.
- The release was `isDraft: true`, `isPrerelease: true`, `targetCommitish` = the tested SHA, `publishedAt: null`.
- npm returned 404 and `package.json` read private `1.1.0-rc.1`.
- Smoke run `37752015020` was `success` with `headSha` = the tested SHA.
- The release notes already carried every required fact (candidate identity, tested SHA, smoke run, delta summary, the "not the full suite" boundary, npm unpublished, prerelease status), so **no notes edit was made**.

## Post-publish verification

| Check | Result |
|---|---|
| rc.2 tag local + remote, annotated, dereference | PASS — exactly the tested SHA; tag object unchanged |
| rc.2 tag object recreated or moved | NO |
| rc.2 releases with that tag | exactly 1 |
| rc.2 draft / prerelease / `publishedAt` | `false` / `true` / 2026-10-08T13:11:16Z |
| rc.2 public URL | HTTP 200 |
| rc.2 marked latest stable | NO (it is a prerelease) |
| rc.1 tag | `46d2a3e59e065816d972dcd56951803951b577f6` — unchanged |
| rc.1 release | id `RE_kwDOTexJrc4XM00N`, still draft, `publishedAt: null` — unchanged |
| npm | 404 — not published |
| `package.json` | `1.1.0-rc.1`, `private: true` — unchanged |
| Source/test/workflow/package/asset changes from this task | none |
| Working tree before this record | clean |

## User QA checklist — v1.1.0-rc.2

Run the editor locally (`npm install` then `npm run dev`, editor `http://localhost:5173/`, API `http://127.0.0.1:5000`) and walk this short pass. Classify every finding as **BLOCKER**, **MAJOR**, **MINOR** or **COSMETIC**.

1. **App opens** — the editor loads, no page error in the console, the canvas and timeline render.
2. **Project basics** — create or open a project; the Layers panel, timeline and Inspector all respond.
3. **Basic shape** — add a shape, drag it on the canvas, resize and rotate it; the Inspector numbers follow the drag.
4. **Text** — add a text layer, edit its value and font size, and confirm the stage repaints the glyphs (not a placeholder box).
5. **Opacity keyframes** — set opacity keyframes at two frames and scrub/play; the layer fades between them.
6. **Bonded pair** — select two layers, Bind them, drag one on the canvas, and confirm the partner follows by the same world delta (in particular when the dragged layer sits inside a parent container).
7. **Motion Curves** — select a keyframed layer, open Motion Curves on a real incoming segment, apply one visible easing edit, and confirm only that layer's segment changes.
8. **Mask / matte** — apply one layer mask or a track matte and confirm the target is masked as expected.
9. **OGraf export** — Export → OGraf Package; the ZIP downloads and contains the scene, manifest and runtime.
10. **OGraf re-import** — import that ZIP back and confirm the project is replaced by the package's editable scene.
11. **Playfair / Cinematic Title** — create the Cinematic Title preset (Playfair Display), export an OGraf package, and confirm the ZIP carries the font plus its OFL license and that the text stays editable.
12. **Stability** — during the whole pass, no obvious crash, freeze or unhandled console error.

**QA rule.** Any **BLOCKER** or **MAJOR** code defect means **do not proceed to a stable release**. Any code change produces a new commit SHA, which invalidates the current exact-SHA smoke result: a new Release Smoke Gate run is required before any further RC or stable decision.

This checklist has **not** been executed by this task — it is the next user action.

## Next step

The user runs the QA pass above against the published prerelease. A stable `v1.1.0` release stays a separate, explicit decision that also requires a fresh smoke run on whatever commit it targets.
