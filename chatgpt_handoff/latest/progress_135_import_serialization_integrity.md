# Progress 135 — Task B: the import boundary, the round-trip and the document transaction

Branch: `fix/import-serialization-transaction-integrity` (base `main` at `1291bb8`).
Findings: **H-03** (malformed values accepted), **H-04** (round-trip loses authoring state), **M-03** (import undo restores only part of the document).

## 1. What was open

1. **H-03.** `validateImportedDocument` checked the fields the *apply* path reads while it queues its updates, but not the values the **renderers and the evaluator** read at frame time. A `textValue` object, a freeform path without points and a channel that is not a keyframe list were all accepted, applied, and then crashed or rendered blank long after the import had returned "success".
2. **H-04.** `toSceneData` never wrote a track's `visible`, `editVisible`, `locked` or `sequencerTemplateId`, and `fromSceneData` read the first two back through an `as Track` cast over fields the persisted type did not declare. A muted, canvas-hidden or locked track came back visible; the sequence link was written and then dropped.
3. **M-03.** `useHistory` snapshotted tracks, layers and sequences only. Undoing an import restored the old layers under the **imported** frame rate, canvas, title and active sequence.

## 2. B1 — the semantic pass (`src/utils/importValidation.ts`)

A second pass runs after the existing scene-field checks and before the document is handed to the apply path. The policy is stated in the module so the rules stay predictable:

- a **required** field is one the apply path has no default for, so its absence silently breaks an id lookup or the z-order (`layer.id`, `layer.zIndex`, `track.partId`);
- every other consumed field is validated **when present** — the documented defaults (`0`, `1`, `'none'`, 1920×1080) are what an absent value already means, so refusing absence would reject documents the editor applies today;
- the first problem refuses the whole document.

Stable refusal codes: `KCS_IMPORT_UNSUPPORTED_VERSION`, `KCS_IMPORT_INVALID_TIMELINE`, `KCS_IMPORT_INVALID_CANVAS`, `KCS_IMPORT_INVALID_LAYER`, `KCS_IMPORT_DUPLICATE_LAYER_ID`, `KCS_IMPORT_INVALID_TRACK`, `KCS_IMPORT_INVALID_TEMPLATE` — each with the offending `path` and a next step.

Covered: the version policy (1 and 2); frame rate and timeline length; canvas size; layer id, z-order, text/colour/font/preset fields, coordinates, `points`, the canonical `path` (which `buildBezierPathD` walks directly), masks (whose `path` the V6 migration dereferences unguarded), matte and boolean structures; track `partId`, numeric channels, mask channels, animated mask paths, legacy composite keyframes and sequence entries.

**Backward compatibility found by the suite, not by inspection:** the first cut required `track.partId` and the full suite refused `P4-S3: imports legacy SceneData with layerId`. v1 files wrote `layerId`, and the apply path reads both names, so either one now satisfies the requirement. This is exactly the class of break the boundary must not cause, and the existing test caught it.

## 3. B2 — the round-trip

`SceneData.tracks` is now typed `(AnimationTrackData & PersistedTrackState)[]`, where `PersistedTrackState` declares `visible`, `editVisible` and `locked` and documents what is deliberately **not** persisted (the generated track name, its colour and its `expanded` flag — session UI state; `TrackOutlinerRow` already notes the name is a generated placeholder).

- **Export** writes the three fields, plus the `sequencerTemplateId` it already wrote.
- **Import** reads them back with the documented defaults (`visible`/`editVisible` visible, `locked` unlocked) and restores `sequencerTemplateId`. The two `as Track` casts are gone — the persisted type now declares the fields.

A file written before this contract keeps exactly the behaviour it had.

## 4. B3 — the document transaction

`useHistory` snapshots gained a `document` member (`HistoryDocumentState`: frame rate, timeline length, canvas, coordinate contract, title, active sequence). One option pair was added — `documentState` and `restoreDocumentState` — so the existing authority was extended rather than a second history system created.

- The recording effect keys on the document's **content**, not its object identity, so a caller that hands over a fresh object every render cannot make every render undoable.
- `undo` and `redo` restore the document with the layers, so an import is one transaction.
- Consequence, stated plainly: a document-level edit (frame rate, canvas, title, active sequence) now participates in undo/redo, because it is document state an import replaces. Recording triggers are unchanged.

## 5. Evidence

| Check | Result |
|---|---|
| H-03 reproduction | 11 malformed shapes refused with the expected code and path; 4 legitimate shapes (including the compatibility fixture with no `width`/`height`, defaults-absent layers, masks + paths + path channels) still accepted |
| H-03 backward compatibility | the existing `layerId` case failed against the first cut and passes after the fix |
| H-04 round-trip | `visible: false`, `editVisible: false`, `locked: true`, `sequencerTemplateId: 'Out'` all survive; a pre-contract file keeps the defaults |
| M-03 hook level | 2 of the new history cases fail without the restore |
| M-03 provider level | the new integration case fails without the restore (`expected 24 to be 60` — the imported frame rate stayed) and passes with it |

## 6. Validation

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

## 7. Self-review (read-only, same model)

- **Reach of the semantic pass.** It walks layers, tracks, channels and keyframes once, after the size/depth/prototype checks, so a hostile document is still refused before the walk. Cost is linear in what the apply path would read anyway.
- **Validation level.** `totalFrames` is only required to be a positive number, not to match the playback setter's `[10, 1200]` clamp: the app accepts and clamps a larger value, so refusing it here would be stricter than the product. Every value the app can reach is already clamped, so a restored snapshot is verbatim.
- **`SceneLayer.visible` is deliberately unchanged.** It is written as a constant `true` and read by the OGraf evaluation, i.e. it is the *document's* layer visibility, not the editor's per-track mute. Mapping the editor mute onto it would change what an exported OGraf package renders — a separate product decision, not a round-trip fix. Recorded here rather than changed silently.
- **The legacy project-template registry is not part of the scene history.** A legacy (non-scene) import also registers a project tab; that registry is the template manager's state, not the scene document, and it is not in the transaction. A modern scene import — the normal path — is fully covered.
- **No parallel authority** was introduced: the boundary keeps one validator, the serializer one mapping, and history one snapshot shape.

## 8. Not changed

- No new dependency, script, workflow, tag or release action.
- The legacy `layerId` shape, the documented defaults, the channels-only export policy and the `??` fallbacks are all preserved.
- No change to the OGraf export mapping or to the project-template registry.
