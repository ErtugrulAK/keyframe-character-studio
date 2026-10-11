# KCS — Authoring UX: Boolean E2E locators + canvas camera invariance (combined line)

## Latest action

The camera-invariance branch `fix/authoring-ux-camera-invariance` now carries the
current authoring-UX base as well. The base branch
`fix/authoring-ux-transform-toolbar` advanced from `dea88ab` to `7d7ebe2` (Boolean
E2E locator alignment) after this camera branch was cut, and rewriting history is
disallowed on this line, so the advanced base was folded in with a **merge
commit** — the only non-history-rewriting way to synchronize. Conflicts were
expected only in the ChatGPT handoff bundle; they were resolved by regenerating
the bundle for the combined state. No code or test file conflicted.

| Field | Value |
|---|---|
| Branch | `fix/authoring-ux-camera-invariance` |
| Old merge base | `dea88ab` (`feat: improve authoring controls and selection visibility`) |
| New UX base | `fix/authoring-ux-transform-toolbar` @ `7d7ebe2` |
| Camera fix commits | `df107b8` (fix), `7ca126c`, `3db69a5` (docs) |
| Boolean E2E locator commits | `f13fed0` (test), `7d7ebe2` (docs) on the base branch |
| Synchronization | merge commit of `origin/fix/authoring-ux-transform-toolbar` into this branch; no rebase, no force-push |
| Conflicts | handoff bundle only: `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`, `chatgpt_handoff/latest/README.md`, `chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md`, `chatgpt_handoff/latest/manifest.txt` — resolved by regenerating the bundle; `chatgpt_handoff/latest/progress_158_trim_path_keyframe_authoring.md` auto-resolved (removed from the bundle on this branch, kept in `reports/`) |
| Stacked PR | [#5](https://github.com/ErtugrulAK/keyframe-character-studio/pull/5) — base `fix/authoring-ux-transform-toolbar`, head `fix/authoring-ux-camera-invariance`, review and CI only, NOT merged |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-camera-invariance` |

## Slice 1 — canvas camera invariance (this branch)

Editor chrome changing size (opening/closing a sidebar, resizing the timeline) used
to pan **and** zoom the authored world. Root cause: the edit SVG filled the stage
and mapped its 600x480 viewBox with `preserveAspectRatio="xMidYMid meet"`, so the
camera content was centred on the stage box centre and magnified by the layout fit
`min(w/600, h/480)`, while the pan/zoom transform was applied about that moving
centre (`StageCanvas.tsx` `dea88ab:757-760`, `:767`; `viewportMath.ts` `dea88ab:29`,
`:151`). Nothing owned the camera, so half of every panel-width change and every
timeline-height change landed on the authored world.

The camera is now its own authority: `StageCameraView` (a view centre in client
pixels plus the px-per-unit scale it was anchored with) and
`getStageCameraTransform` in `src/utils/viewportMath.ts`, with
`getCursorAnchoredCameraCenter` / `clientToCameraPoint` for wheel zoom and pointer
mapping. `StageCanvas` folds a measured stage box into the camera inside the same
frame (`ResizeObserver` + `flushSync`); a layout-only change leaves the camera
untouched, while a change of the application window itself re-anchors the camera
with its pan offset and a fresh scale.

Measured drift before the fix (real Chromium, isolated ports, stage `336,79
584x321`, 0.6687 px/unit): +180.00 px on both world points for the right sidebar
open → closed, −168.00 px for the left sidebar open → closed, and up to
(−36.55, +66.73) / (+42.64, +112.41) when the timeline collapsed. After the fix
every transition — sidebar close/open, timeline collapse/expand/resize up/resize
down, ten repeated cycles per surface, and a panned camera across chrome changes —
measures **0.00 px** on both authored world points and on the rendered node box,
with the magnification (0.6687 px/unit) and the zoom label unchanged, the
serialized document byte-identical and the undo depth unchanged.

## Slice 2 — Boolean E2E locator alignment (base branch, now in this line)

`dea88ab` gave the four Boolean buttons `aria-label={`Create ${operation} Boolean`}`
while adding their icons. An `aria-label` overrides the visible caption as the
accessible name, so the old names (`Union`, `Subtract`, `Intersect`, `Exclude`) no
longer matched `getByRole('button', { name, exact: true })`. Eleven assertions —
9 in `e2e/boolean-text-operands.spec.ts`, 1 in `e2e/editor-interaction.spec.ts` and
1 in `e2e/v51-manual-qa.spec.ts` — still queried the old names, so the locator
never resolved, the click timed out, and no Boolean operation was dispatched; the
full Chromium suite reported 11 failures. `f13fed0` aligns those locators with the
exact new accessible names through one shared helper (`Create <operation> Boolean`,
`exact: true`, no regex or text fallback, no accessibility assertion removed) and
closed all 11: the focused run went from 11 failed / 9 passed to 20 passed, and the
full Chromium suite reached 268 passed with `--retries=0`. It changes no
application source (`git diff dea88ab -- src/` is empty).

## Combined validation

The merge brings both slices together, so the full `--retries=0` Chromium suite,
the camera Chromium spec, the camera unit tests, the focused Boolean specs and the
repository gates were re-run on the merged tree on the isolated ports. The combined
head SHA, the exact counts, the camera drift numbers and the PR #5 CI run are
recorded in the refreshed bundle that follows this merge commit.

## Boundaries

The user's live QA preview, the API on `127.0.0.1:5000`, the stable repository
`keyframe-character-studio` (`main` at `c46e698`) and the unrelated worktrees were
never written to, restarted or killed by this work. Every test used the isolated UI
5188 / API 5003 pair (release gate 5189, V6 QA 5187), and the vite/server process
command lines were verified to come from this worktree. No merge to `main`, no
rebase, no force push, no tag, no release, no version bump and no dependency change
was performed.
