# KCS OGraf Runtime Parity — Phase A (branch validated, not merged)

Branch `fix/ograf-runtime-parity-phase-a` at `3f41400ee79f69cf489f3acf67166c7bd0a98f51`, validated in an isolated worktree. The stable QA checkout stayed clean at `c46e698` and its editor/API (5173/5000) were never touched.

## What the branch does

The generated runtime hand-copied two KCS rules and both copies drifted — the painted order was inverted (the runtime sorted the authored array while the editor sorted by `zIndex`) and a disabled Track Matte V2 suppressed the legacy matte in the export but not in the editor.

The copies are gone. `src/ograf/runtimeSnippets.ts` embeds each canonical helper's own source with `Function.prototype.toString`, so the runtime runs the same text the editor runs: the stacking comparator from `src/utils/stackingOrder.ts` and the matte precedence from `src/utils/matte.ts`. `svgRenderer` calls the same resolver directly instead of carrying a third copy. `ografRuntimeParity.test.ts` asserts the embedded text IS the canonical source, that the generated module holds no hand-written rule, and that editor, static renderer and runtime agree on painted order, matte precedence, no-source fallback and `sourceVisible`.

## Validation

Isolated ports only: `PORT=5001 npm run qa:release` (UI 5189) 2 passed; `PORT=5001 npm run qa:v6` (UI 5187) 3 passed; `CI=1 PORT=5001 npx playwright test --project=chromium --retries=0` (UI 5188) 265 passed. Full local gate green: tsc, lint, 138 Vitest files / 2,102 tests, build, `validate:ograf`, `npm run check`, state consistency (38 checks), audit 0, `git diff --check`.

## Decisions

- `sourceVisible: v2.sourceVisible !== false` stays local: it is a one-field default normalisation, not a branching policy, and the parity test covers its behaviour in both paths.
- No drift-gate script was added: KCS has no tracked generated artifact. Vendored OGraf schema drift is already guaranteed by SHA-256 pin validation, and this branch's runtime duplication is guarded by the parity tests.

## State

Pull request #3 (https://github.com/ErtugrulAK/keyframe-character-studio/pull/3) is open at head `e5a2b8a`, and its `pull_request` CI run `37938283542` concluded **success**. Merge is withheld — the user's QA session is still active. No tag, release or npm action. A fresh exact-SHA Release Smoke Gate is required on the final candidate SHA, as a separate zero-modification task.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.
