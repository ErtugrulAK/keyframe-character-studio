# V7.1 — Temporal Input Policy Decision Matrix

Status: **AUDIT ONLY — NOT APPROVED OR IMPLEMENTED.** No import, restore, evaluator, persistence, schema or recovery-UI behavior is changed by this document.

Source baseline: `test/v7-combined-verified` at `b6c2d78d3f96e10fa9df2d21d0d13cde2595d586`. The V7.1 Lottie HOLD and unwired speed-math patches do not implement this policy. Findings come from current source and fresh-process local-Qwen probes; Sol reviewed the boundary and restore source. Raw probes are local evidence, not production dependencies.

## 1. Actual authorities and evidence

- `src/utils/importValidation.ts:490–577`: numeric channels validate finite frame/value and identity; mask-path channels validate frame/path; legacy composite keys validate frame/transform. None validates `easing`, `bezierIn`, `bezierOut` or `bezierControlPoints`.
- `src/hooks/useSerialization.ts:562–590`: autosave restore uses the same `validateImportedDocument`. A refused payload is warned to the console and not applied. The rejection branch does not delete or repair the stored key. This is not a visible recovery preview. Do not generalize this to the separate legacy-stickman deletion branch at lines 593–600.
- `useSerialization.ts:818–826`: import validation precedes document application. Existing import-atomicity tests are the behavioral safety net; the audit's boundary probes alone do not prove every React setter transaction.
- `src/utils/defaults.ts`, `interpolateChannel`, `interpolatePathChannel`, `applyEasing`: HOLD first, then a complete neighboring temporal pair, explicit/derived control points, then named easing. Invalid values are not comprehensively screened before solving.
- `src/ograf/validation.ts:129–152`: **export/compiler** validation rejects malformed/nonfinite temporal handles and control-point tuples. It is not evidence that KCS project import rejects them. The generated OGraf runtime also has boot-time metadata checks.
- Lottie has its own finite component reader and unreadable-handle diagnostics. That boundary is not KCS import/restore enforcement.

Observed fresh-process probes against the real modules:

| Probe | Actual result |
|---|---|
| KCS numeric text containing control-point or handle `1e309` | Accepted by `validateImportedDocument` |
| Short control-point array, control-point string/object, scalar handle | Accepted by that boundary |
| Unknown easing name | Accepted; unpaired evaluator uses its linear default |
| Nonfinite complete handle pair / short control-point tuple evaluated directly | `NaN` |
| Extreme finite y control points | Can produce `Infinity` despite finite inputs |
| Outgoing-only or incoming-only valid pair | Lower authority tier, as currently designed |
| `JSON.stringify` of an in-memory Infinity handle coordinate | Coordinate becomes `null`; reparsed poisoned payload was accepted |
| Truncated JSON, scalar root, unsupported scene version | Refused by existing validation |
| Finite crossed-x Elastic control points, y outside the future slope envelope | Accepted and evaluated; must remain compatible |

JSON has no `Infinity` literal, but exponent text such as `1e309` parses to IEEE Infinity. Serializing an already nonfinite JavaScript number as `null` is a distinct hazard. The probes demonstrate numeric/evaluator effects, not an observed blank browser canvas or an end-user data-loss incident.

## 2. Compatibility matrix

| Input/document class | Current behavior | Candidate A: strict atomic boundary rejection | Candidate B: defensive evaluation | Compatibility / approval |
|---|---|---|---|---|
| Valid finite full pair | Accepted; pair owns curve except HOLD | Preserve | Preserve | Required |
| Valid finite partial pair | Accepted; lower tier used | Preserve; not invalid merely because incomplete | Preserve normal authority | Required; no pair completion by import |
| Missing optional fields | Accepted; existing defaults/authority | Preserve absence | Preserve | Required |
| Finite legacy four-number control points | Accepted; legacy conversion carries supported cp metadata | Preserve | Preserve | Required; no migration |
| Crossed x coordinates in [0,1] | Supported, including shipped Elastic preset | Preserve; no `x1 <= x2` rule | Preserve | Required |
| Finite y outside [-0.5,1.5] | Supported authored data; envelope is not storage policy | Preserve | Preserve | Required |
| Present handle with missing/string/null x/y; scalar/array handle | Boundary currently admits malformed shapes | Reject with exact field path | Invalid in-memory shape must not reach solver | Newly rejected files; explicit approval |
| Present cp with wrong shape/arity/nonfinite member | Boundary currently admits it | Reject with exact field path | Invalid in-memory tuple must not reach solver | Newly rejected files; explicit approval |
| Present-null entire optional handle/cp | Accepted; truthiness often treats it as absent | Decision: reject present-null vs explicitly accept as historical absence | Must agree with chosen boundary semantics | Open decision; do not silently coerce storage |
| Nonfinite coordinate via exponent text | Accepted, can poison evaluation | Reject whole document, no setters | Backstop for corruption bypassing boundary | Approval required |
| Extreme but finite values | Accepted; arithmetic can still overflow | A finite-only rule still accepts these | Shape/finite-input checks alone are insufficient; output-overflow response needs a documented decision | Do not claim A+B solves all finite arithmetic |
| Unknown string easing name | Accepted; usually linear default | Decision: preserve legacy fallback vs reject unknown name | Preserve chosen precedence, including valid complete pairs | Separate compatibility decision |
| Wrong-typed easing field | Admitted by temporal-blind checks | Proposed rejection when present and demonstrably mistyped | Narrow guard requires matching policy | Approval required |
| Damaged autosave JSON/version | Existing refusal; defaults retained, console warning | Preserve raw payload; do not overwrite on refusal | Not applicable until a valid state is applied | Recovery visibility is separate UI work |
| Autosave containing nonfinite-to-null damage | May currently restore altered numeric meaning | Could newly refuse whole restore depending on null policy | Guard must not rewrite the stored payload | Recovery and autosave overwrite protection must be designed together |
| Otherwise valid existing authored documents | Existing behavior | Must remain accepted, including partial pairs, defaults, valid easing names, out-of-envelope y | Must retain same frame values | Acceptance corpus required |
| Legacy composite temporal handles | Some conversion/apply paths do not carry these fields | Do not incidentally change conversion semantics | Do not invent support through a guard | Existing limitation; not a policy cleanup |
| Rejected file import | Validation returns before application | Keep whole-document rejection; no partial salvage | Not applicable | Must preserve live project/history/selection/storage |

## 3. Options and recommendation

**A — Strict atomic import/restore rejection.** Extend the existing boundary rather than adding a parallel validator. Validate fields only when present. Report the first actionable typed/finite violation at its exact keyframe/field path. A diagnostic code such as `KCS_IMPORT_INVALID_TEMPORAL` is a proposal, not an existing contract. No clamp, replacement, pair completion, deletion or mutation of the source document. File import and autosave share a validator: do not promise differing semantics without an explicit API/design decision.

**B — Narrow defensive evaluator guard.** Protect invalid in-memory data that bypasses a boundary while leaving authored storage unchanged. HOLD must still win before handle inspection. A fallback to the next authority tier changes evaluated motion even without mutating the document; it is **not** a faithful repair and is not automatically user-visible. The selected fallback/error indication, diagnostics ownership and generated-runtime parity must be approved. Finite input arithmetic overflow needs separate treatment from mistyped/nonfinite input; do not smuggle arbitrary magnitude limits into this work.

**C — Explicit recovery preview.** Preserve the original payload, show path-level problems and any proposed recovery before applying a modified copy. Highest UX/safety scope; requires approved interaction semantics, cancel behavior, backup/export and autosave overwrite protection. Not implemented here.

Recommended candidate: **A for demonstrably invalid typed/nonfinite fields, plus a narrowly specified B backstop, with no silent storage mutation.** Keep C separate but decide the damaged-autosave preservation/visibility story before shipping newly rejected restore cases. This is not approval to implement any option.

## 4. Impact and required decisions

1. Decide present-null versus absent semantics using existing exported/saved samples, not only types. Strict rejection can make a previously loadable damaged autosave unavailable; its original bytes must remain recoverable.
2. Decide invalid easing-name compatibility independently of handle shape/finite validation.
3. Define B's exact fallback or explicit failure signal and its UI diagnostics. An invisible lower-tier fallback must not be marketed as recovery.
4. Mirror intentional evaluation behavior in the emitted runtime where applicable; boot rejection and editor in-memory defense are different boundaries.
5. Define finite-overflow handling without imposing a gesture envelope on stored data. Finite does not imply evaluable within IEEE range.
6. Inspect numeric authoring boundaries separately. `TemporalGraphPanel.tsx:266–279` calls `Number(event.target.value)` without its own finite check. The audit did **not** exercise browser number-input sanitization, so typing `1e309` is not claimed to be a verified UI reproduction.
7. Do not change serialized types, storage keys, versions, migration rules, preset semantics or legacy conversion as a side effect.

## 5. Proposed behavioral tests — not implemented

- Parameterized real-boundary rejection across scene channels, mask channels, mask-path timing and legacy keys: malformed shapes, wrong cp arity, missing coordinate, wrong type and exponent-to-Infinity. Assert exact diagnostic path and unchanged live scene/history/storage on failure.
- Acceptance corpus: full/partial pairs, absent optional fields, all valid easing names, crossed x, finite Elastic y, legacy cp and real previously exported documents. Assert evaluated frame values and round-trip meaning, not object wiring.
- Autosave refusal: original key bytes unchanged, no document apply/history-baseline claim, no subsequent autosave overwrites the refused source before an explicit recovery decision. Exercise restart/cancel/export behavior when approved.
- In-memory backstop: HOLD precedence, invalid pair vs valid cp/named fallback, invalid cp, mask-path and transform consumers, emitted-runtime agreement for the selected approved semantics. Assert both frame outputs and required visible/error signal.
- Finite-overflow counterexamples separately from nonfinite input; normal large representable and subnormal values must not be rejected through arbitrary thresholds.
- Recovery preview, only if approved: cancel is mutation-free; modified copy is explicit, original recoverable; one accepted import remains one logical document replacement.

## 6. Rollback design

No migration means no data-conversion rollback. Implement any future approved policy in isolated forward commits with a documented diagnostic contract and unchanged serialized schema. Before shipping, preserve the original input bytes and ensure newly refused autosaves cannot be replaced by defaults through ordinary autosave. Rollback is a reviewed **forward commit** removing the new rejection/guard behavior, not rebase/reset or a write-back that rewrites user data. Keep the acceptance corpus and invalid-input regressions to explain the restored boundary behavior; never weaken assertions to label it fixed. A rollback may re-admit malformed files and restore the old risk, so it requires an explicit readiness decision. Recovery exports must contain original or explicitly repaired copies with unambiguous names; no automatic repair is authorized.

## 7. CI classification (R4)

Default PR `.github/workflows/ci.yml` runs OGraf manifest validation, lint, TypeScript project build, Vitest and production build. **No browser step.** `chromium-smoke.yml` is manual/weekly and selects four specs. `release-smoke.yml` is manual, exact-SHA-pinned and invokes a two-test OGraf release smoke; it is not the full Chromium suite. The existing smoke workflow's broad comment about the full suite is not authority over the actual runner.

V7.1 does not change workflow triggers or CI cost/gate semantics. Report default CI, locally executed full Chromium, visual checks and release smoke as separate evidence. R4 remains a known CI coverage gap, not a secretly completed CI feature.
