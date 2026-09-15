# Progress 087 — Parent-Cycle and Broadcast-Map Hardening Merge

## Task

Task 1: Parent-cycle and broadcast-state map hardening.

## Merge

- Baseline `main`: `24151b7`
- Feature branch: `fix/parent-cycle-broadcast-map-hardening`
- Feature fix commit: `0ab91f4`
- Feature patch report commit: `33de647`
- Merge mode: fast-forward only
- Main after merge: `33de647`

## Post-Merge Validation

Executed on merged `main` after `npm ci`:

- Focused Task 1 suite: 5 files, 140 tests passed.
- Full Vitest suite: 101 files, 1491 tests passed.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with the existing Fast Refresh warning at `src/context/AnimatorContext.tsx:655`.
- `git diff --check`: passed.
- `validate:ograf`: N/A; no committed fixture target exists before Task 4.

`npm ci` retained the existing blocked `sqlite3@6.0.1` install-script warning. The build retained the existing large-chunk warning.

## Security Result

READY WITH WARNINGS. No merge-blocking finding remained.

Completed protections:

- OGraf self-parent and multi-node hierarchy cycles fail closed.
- Evaluator recursion terminates while preserving self-parent no-op and dangling-parent fallback behavior.
- Generated runtime validates hierarchy cycles before rendering and guards recursive evaluation.
- Broadcast/live-stunt maps preserve prototype-sensitive IDs as data keys using null-prototype containers and own-property-safe access.

## Remaining Follow-Up Risks

These remain outside Task 1:

- sourcePath/filesystem trust boundary and OS-level symlink/TOCTOU policy;
- mask/matte canonical versus generated visual parity;
- deterministic OGraf fixture/schema validation and CI gate;
- release-grade Playwright/import-export/runtime smoke;
- tooling path audit, living documentation reconciliation, and release-readiness decision.

## Preserved Contracts and Safety

- OGraf package layout and `.ograf.json`/`.kcs` distinction preserved.
- `evaluateTransform`/`evaluateFrame` remain authorities.
- Active-sequence scoping and `Track.channels` preserved.
- No global OMP config, model role, memory backend, hook, route, gateway, server, secret, Supabase production connection, Strix scan, Skill UI crawl, OCR/model download, release, or tag operation.
- No force push, reset, rebase, normal merge, or branch deletion.
- `without-mask` untouched.

## ChatGPT’ye Yüklenecek Dosyalar

- `reports/progress_086.md`
- `reports/progress_087.md`
- `src/ograf/validation.ts`
- `src/utils/evaluateTransform.ts`
- `src/ograf/runtimeTemplate.ts`
- `src/utils/broadcastEngine.ts`
- `src/hooks/useBroadcast.ts`
- `src/components/Canvas/StagePartLayers.tsx`
- `src/tests/ografExport.test.ts`
- `src/tests/evaluateFrame.test.ts`
- `src/tests/broadcastEngine.test.ts`
