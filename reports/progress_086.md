# Progress 086 — Parent-Cycle and Broadcast-Map Hardening

## Task

Task 1: parent-cycle and broadcast-state map hardening.

## Baseline and Branch

- Baseline `main`: `24151b7`
- Branch: `fix/parent-cycle-broadcast-map-hardening`
- Patch commit: `0ab91f4` — `fix: harden parent cycles and broadcast maps`

## Implemented

- OGraf validation now detects self-parent and multi-node cycles through `parentId` or `booleanGroupId` and rejects reserved parent keys.
- Dangling parent IDs remain compatible with the existing editor fallback behavior.
- `evaluateTransform` now has a per-call recursion guard while preserving self-parent no-op and missing-parent fallback semantics.
- Generated runtime scene validation rejects hierarchy cycles before rendering.
- Generated runtime hierarchy evaluation has a recursion guard.
- Broadcast and live-stunt state maps use null-prototype containers and own-property-safe reads/writes at the pure engine and UI adapter boundaries.
- Existing broadcast timing and named-sequence behavior remains unchanged.

## Tests and Validation

- Focused Task 1 suite: 5 files, 140 tests passed.
- Full Vitest suite: 101 files, 1491 tests passed.
- `npm ci`: passed; existing `sqlite3@6.0.1` install-script approval warning remains.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with the existing `AnimatorContext.tsx:655` Fast Refresh warning.
- `git diff --check`: passed.
- `validate:ograf`: N/A; no repository fixture target is configured before Task 4.

## Independent Review

Independent review result: READY WITH WARNINGS.

No blocking finding. Non-blocking test-quality warning: cycle evaluator tests assert termination and finite output, not an exact cycle fallback transform; generated-runtime cycle coverage is verified through source-flow review rather than direct constructor execution because the jsdom custom-element constructor reports thrown errors as uncaught events.

## Preserved Contracts

- Existing public APIs remain unchanged.
- Valid parent chains remain valid.
- Missing parents retain root/fallback behavior.
- `evaluateTransform` and `evaluateFrame` remain the transform authorities.
- Valid broadcast/live-stunt timing remains unchanged.
- OGraf package format and active-sequence/channel contracts remain unchanged.

## Safety

No global OMP config, model roles, hooks, routing, secrets, Supabase production connection, Strix scan, Skill UI crawl, OCR/model download, release, tag, force push, reset, rebase, or normal merge operation was performed.

## ChatGPT’ye Yüklenecek Dosyalar

- `reports/progress_086.md`
- `src/ograf/validation.ts`
- `src/utils/evaluateTransform.ts`
- `src/ograf/runtimeTemplate.ts`
- `src/utils/broadcastEngine.ts`
- `src/hooks/useBroadcast.ts`
- `src/components/Canvas/StagePartLayers.tsx`
- `src/tests/ografExport.test.ts`
- `src/tests/evaluateFrame.test.ts`
- `src/tests/broadcastEngine.test.ts`
