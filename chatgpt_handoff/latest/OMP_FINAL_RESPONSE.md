# KCS — Authoring UX combined line: canvas camera invariance + Boolean E2E locator alignment

## Latest action

The camera-invariance branch `fix/authoring-ux-camera-invariance` now carries the
current authoring-UX base as well, and the combined line is fully validated. The
base branch `fix/authoring-ux-transform-toolbar` advanced from `dea88ab` to
`7d7ebe2` (Boolean E2E locator alignment) after this camera branch was cut, and
rewriting history is disallowed on this line, so the advanced base was folded in
with a **merge commit** — the only non-history-rewriting way to synchronize.
Conflicts appeared only in the ChatGPT handoff bundle and were resolved by
regenerating the bundle for the combined state; no code or test file conflicted.
Nothing was merged to `main`.

| Field | Value |
|---|---|
| Branch | `fix/authoring-ux-camera-invariance` |
| Old merge base | `dea88ab` (`feat: improve authoring controls and selection visibility`) |
| New UX base | `fix/authoring-ux-transform-toolbar` @ `7d7ebe2` |
| Camera fix commits | `df107b8` (fix), `7ca126c`, `3db69a5` (docs) |
| Boolean E2E locator commits | `f13fed0` (test), `7d7ebe2` (docs) on the base branch |
| Synchronization | merge commit `aef21de5aad06592884d7a54004383b2f6eeccb1` of `origin/fix/authoring-ux-transform-toolbar`; no rebase, no force-push |
| Combined head | `aef21de5aad06592884d7a54004383b2f6eeccb1` |
| Conflicts | handoff bundle only: `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`, `chatgpt_handoff/latest/README.md`, `chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md`, `chatgpt_handoff/latest/manifest.txt` — resolved by regenerating the bundle; `chatgpt_handoff/latest/progress_158_trim_path_keyframe_authoring.md` auto-resolved (removed from the bundle on this branch, kept in `reports/`) |
| Stacked PR | [#5](https://github.com/ErtugrulAK/keyframe-character-studio/pull/5) — base `fix/authoring-ux-transform-toolbar`, head `fix/authoring-ux-camera-invariance`, MERGEABLE, review and CI only, NOT merged |
| PR CI | `CI Pipeline` run `38146201264` (pull_request) — success on the combined head `aef21de` |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-camera-invariance` |
| Live preview | `http://localhost:5173/` served from this worktree by `vite --host --port 5173` |

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
(−36.55, +66.73) / (+42.64, +112.41) when the timeline collapsed. After the fix every
transition measures **0.00 px** on both authored world points and on the rendered
node box — sidebar close/open, timeline collapse/expand/resize up/resize down, ten
repeated cycles per surface, and a panned camera across chrome changes — with the
magnification (0.6687 px/unit) and the zoom label unchanged, the serialized document
byte-identical and the undo depth unchanged.

## Slice 2 — Boolean E2E locator alignment (base branch, now in this line)

`dea88ab` gave the four Boolean buttons `aria-label={`Create ${operation} Boolean`}`
while adding their icons. An `aria-label` overrides the visible caption as the
accessible name, so the old names (`Union`, `Subtract`, `Intersect`, `Exclude`) no
longer matched `getByRole('button', { name, exact: true })`. Eleven assertions —
9 in `e2e/boolean-text-operands.spec.ts`, 1 in `e2e/editor-interaction.spec.ts` and
1 in `e2e/v51-manual-qa.spec.ts` — still queried the old names, so the locator never
resolved, the click timed out, and no Boolean operation was dispatched. `f13fed0`
aligns those locators with the exact new accessible names through one shared helper
(`Create <operation> Boolean`, `exact: true`, no regex or text fallback, no
accessibility assertion removed) and closed all 11 on the base line. It changes no
application source (`git diff dea88ab -- src/` is empty).

## Combined validation (merged tree, isolated ports)

Every command ran in the camera worktree against the combined head `aef21de`.
Browser tests used the isolated `CI=1 PORT=5003` preset (vite `127.0.0.1:5188`, API
`127.0.0.1:5003`; release gate `5189`, V6 QA `5187`) with `--retries=0`.

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | exit 0 |
| `npm run lint` (`oxlint`) | exit 0 |
| `npm test` (`vitest run`) | 138 files / 2095 tests passed |
| `npm run build` | exit 0 |
| `npm run validate:ograf` | valid OGraf v1 manifest |
| focused Boolean E2E (`boolean-text-operands`, `editor-interaction`, `v51-manual-qa`, `--retries=0`) | 20 passed (15.9s) — zero inherited locator failures |
| focused camera E2E (`e2e/camera-invariance.spec.ts`, `--retries=0`) | 5 passed (38.9s), drift 0.00 px on every transition |
| `PORT=5003 npm run qa:release` | release gate passed for candidate SHA `aef21de` (2 Chromium tests) |
| `PORT=5003 npm run qa:v6` | 3 Chromium tests passed |
| `npm run check` | exit 0 |
| `node scripts/check-state-consistency.mjs` | PASS, 40 checks |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | empty |
| full Chromium suite (`CI=1 PORT=5003 npx playwright test --retries=0`) | **273 passed**, 0 failed / 0 flaky / 0 skipped (2.2m) |

The full suite count is the base line's 268 plus the camera spec's 5, and the 11
inherited Boolean failures are closed on this line — 273 passed with no retries.

## Preview and isolation

`http://localhost:5173/` is served from this worktree by `vite --host --port 5173`
(process command line resolves into
`...\keyframe-character-studio-omp-camera-invariance\node_modules\.bin\..\vite\bin\vite.js`),
the served head is `aef21de5aad06592884d7a54004383b2f6eeccb1` on branch
`fix/authoring-ux-camera-invariance`, and the served camera module exports
`getStageCameraTransform` / `clientToCameraPoint`. During the full suite only
`127.0.0.1:5188` (vite) and `127.0.0.1:5003` (API) were bound by test processes, and
all of them resolved into this worktree; `127.0.0.1:5000` (API, unchanged PID
24896) kept answering 200. The stable repository `keyframe-character-studio`
(`main` at `c46e698`), the runtime-parity worktree and the authoring-UX worktree were
not written to by this work.

## Boundaries

No merge to `main`, no rebase, no force push, no tag, no release, no version bump and
no dependency change was performed; PR #4 and PR #5 were not merged and no duplicate
PR was opened. Source, tests, package files, workflows, binaries, assets, caches and
QA output are outside this bundle.
