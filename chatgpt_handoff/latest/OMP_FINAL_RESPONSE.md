# KCS Post-Review Correctness Fix — Task B Final Response (import / serialization transaction integrity)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** implemented on `fix/import-serialization-transaction-integrity` (base `main` at `1291bb8`); the merge decision is with the user.
- **Report:** `reports/progress_135_import_serialization_integrity.md`.
- **Findings closed:** H-03 (malformed values accepted by the import boundary), H-04 (save/load round-trip loses persistent authoring state), M-03 (import undo restores only part of the document).

## 2) H-03 — the boundary now checks what the renderers read

`validateImportedDocument` checked the fields the **apply** path reads while it queues its updates, but not the values the **renderers and the evaluator** read at frame time. A `textValue` object, a freeform path without points and a channel that is not a keyframe list were accepted, applied, and then crashed or rendered blank long after the import reported success.

A second pass now runs before the document reaches the apply path:

- **required** fields are the ones the apply path has no default for (layer `id`, layer `zIndex`, track `partId`);
- every other consumed field is validated **when present**, because the documented defaults (`0`, `1`, `'none'`, 1920×1080) are what an absent value already means — refusing absence would reject documents the editor applies today;
- the first problem refuses the whole document.

Stable codes: `KCS_IMPORT_UNSUPPORTED_VERSION`, `KCS_IMPORT_INVALID_TIMELINE`, `KCS_IMPORT_INVALID_CANVAS`, `KCS_IMPORT_INVALID_LAYER`, `KCS_IMPORT_DUPLICATE_LAYER_ID`, `KCS_IMPORT_INVALID_TRACK`, `KCS_IMPORT_INVALID_TEMPLATE` — each with the offending path and a next step.

**Backward compatibility caught by the suite:** the first cut required `track.partId`, and the existing `P4-S3: imports legacy SceneData with layerId` case failed. v1 files wrote `layerId` and the apply path reads both names, so either one now satisfies the requirement.

## 3) H-04 — the round-trip

`SceneData.tracks` is now typed `(AnimationTrackData & PersistedTrackState)[]`. The three flags are written on export and read back on import with the documented defaults, and `sequencerTemplateId` is restored. The generated track name, its colour and its `expanded` flag stay session state (the outliner already notes the name is a generated placeholder), and a file written before this contract behaves exactly as it did.

## 4) M-03 — one document transaction

`useHistory` snapshots gained a `document` member (frame rate, timeline length, canvas, coordinate contract, title, active sequence), added through one option pair (`documentState`, `restoreDocumentState`) — the existing authority extended, not a second history system. The recording effect keys on the document's **content**, not its object identity, so a caller that hands over a fresh object every render cannot make every render undoable.

Consequence, stated plainly: a document-level edit now participates in undo/redo, because it is document state an import replaces. Recording triggers are unchanged.

## 5) EVIDENCE

- **H-03:** 11 malformed shapes refused with the expected code and path; 4 legitimate shapes still accepted, including the compatibility fixture that carries no top-level `width`/`height`, a defaults-absent scene, and one with masks, a freeform path and path channels.
- **H-04:** `visible: false`, `editVisible: false`, `locked: true`, `sequencerTemplateId: 'Out'` all survive the round-trip; a pre-contract file keeps the defaults.
- **M-03 hook level:** 2 of the new history cases fail without the restore.
- **M-03 provider level:** the new integration case fails without the restore (`expected 24 to be 60` — the imported frame rate stayed) and passes with it.

## 6) VALIDATION

| Check | Result |
|---|---|
| `npm test` | PASS — 125 files / 1,902 tests |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run build` | PASS |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests, candidate `214000b` |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 3 tests |
| `node scripts/check-state-consistency.mjs` | PASS — 33 checks |
| `git diff --check` | clean |

## 7) SELF-REVIEW NOTES

- The pass walks layers, tracks, channels and keyframes once, after the size/depth/prototype checks, so a hostile document is still refused before the walk.
- `totalFrames` is only required to be a positive number, not to match the playback setter's `[10, 1200]` clamp: the app accepts and clamps a larger value, so a stricter rule here would be stricter than the product. Every value the app can reach is already clamped, so a restored snapshot is verbatim.
- **`SceneLayer.visible` is deliberately unchanged.** It is written as a constant `true` and read by the OGraf evaluation, i.e. it is the *document's* layer visibility, not the editor's per-track mute. Mapping the editor mute onto it would change what an exported OGraf package renders — a separate product decision, not a round-trip fix.
- **The legacy project-template registry is not part of the scene history:** a legacy (non-scene) import also registers a project tab, which belongs to the template manager rather than the scene document. A modern scene import — the normal path — is fully covered.

## 8) NEXT

- Task C (Lottie structure correctness: H-05, M-01, M-02) is next, then D (H-02), E (H-06), F (M-04), G (M-05) — each on its own branch with its own validation and merge gate.
