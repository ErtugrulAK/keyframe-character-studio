# KCS V7 Verified Working Ledger

Status: **VERIFIED SOURCE CANDIDATE; NOT MERGED; NOT RELEASE-READY.** Resource-policy exception recorded below. This is the single V7 working ledger; the progress report and upload file are dated exports, not competing state authorities.

## Baseline and final authority

- Canonical checkout: `C:/Users/ertugrul.ak/Desktop/keyframe-character-studio`, branch `main`.
- Starting/final local HEAD, cached origin/main and live origin/main: `b6b3c2cbcfc8727f38129d207526e3167c591526`.
- Final candidate: `b6c2d78d3f96e10fa9df2d21d0d13cde2595d586`, branch `test/v7-combined-verified`, `.worktrees/v7-candidate`.
- Assembly: exact source diffs plus scoped keep-all overlap resolution; **no git merge, cherry-pick or rebase**. Intermediate candidate `31c01bb2d23b7429d12bb613126fbea7c58f83f4` excluded PR63 and is not the certified final head.
- Immutable input manifest: candidate `docs/KCS_V7_CANDIDATE_MANIFEST.json`, scope `FINAL_12_PR_SOURCE_CANDIDATE`.
- Instrumented source-work interval: 2026-10-20T21:24:58.411Z to 2026-10-20T23:04:11.815Z = 99 minutes 13 seconds; startup discovery preceded the first timestamp and final handoff followed it. No 8–9-hour execution claim.

## 1. MERGED AND SOURCE VERIFIED

Git/GitHub show PR38–51 merged and their merge commits on canonical main. Source review is narrower than ancestry: the canonical scalar evaluator and channels, PR47 velocityMath, PR49 graph rendering, PR44 ruler path, timeline/history/import/runtime ownership were inspected. Ancestry/file existence is not falsely called exhaustive semantic or runtime verification. No PR was merged by V7.

## 2. OPEN PR, SOURCE VERIFIED

All following exact heads were inspected at relevant source/diff seams and their direct commit check-runs are success. Runtime certification is the separate candidate matrix below, not implied by CI.

| PR | Branch | Final full head SHA | CI run |
|---|---|---|---|
| 52 | fix/q1-gif-badge-readiness | feb70f71b7213e341a9468213ce9e243f9cd786d | 39427009523 |
| 53 | fix/q2-import-dialog-race | af5c5c17d91a88deb1914034342091c2bca0c209 | 39427104922 |
| 54 | fix/q3-drawer-layout-settle | 4af5a1666bafe8f63066172ea3afcb4e73ecf806 | 39427186472 |
| 55 | docs/f5-speed-graph-inverse | 68c4727dd45d089ce58c0edf8d17166aae3846d7 | 39505585793 |
| 56 | test/v1-visual-harness | fc1f0df1bee07dda5ea45371dd674891a05d6051 | 39496713305 |
| 57 | feat/e1-easing-presets | a16063980c1811f76f682a7f6f6bb84845e0c34d | 39508582743 |
| 58 | feat/f5a-speed-inverse-math | 45ef1309a42e59f20b6d53ee57765982e2a1979f | 39505757448 |
| 59 | test/m2-velocity-adversarial | 9a1202ce30813512eaeea9c5a4d2c76dfa6a46b8 | 39445150964 |
| 60 | fix/g2-segment-badge-handle-truth | a432dbc2541f51276fb7c2298db7311efaada29c | 39508183235 |
| 61 | docs/round3-blueprints | 0b923afac5577b3c69e7b2915cbf9f302a434eaa | 39496528718 |
| 62 | docs/v6-session-handoff | 95e94760f37497836e35e1ce96aaa18bf1d5166d | 39506705575 |
| 63 | fix/v7-lottie-partial-easing-diagnostics | 8b70a9b465ee27d006f2a121c60f97f5063f0137 | 39508715423 |

Actual V7 authoring: PR57 restored missing authored-local capture and added provider undo regressions; PR58 fixed signed degenerate slopes/range refusals; PR55 corrected the matching specification; PR60 repaired the obsolete browser-test contract without rewriting correct production badges; PR62 removed false history and fixed its mirror; new PR63 adds truthful diagnostics without changing imported scene output. PR52–54/56/59/61 were reused, not falsely claimed as new V7 development.

## 3. LOCAL ONLY, SOURCE VERIFIED

No unfinished local-only product code is represented as completed. Existing `tmp/v5-combined` at `2ba4641807a1af8b3556c34bc50e243270015593` and detached q4-matrix at f89f367 remain historical candidates, not final-main evidence. New V7 source candidate is normally pushed but has no new PR. Report/upload work is isolated on `docs/v7-verified-director`; no canonical artifact was overwritten.

## 4. DOCUMENTATION ONLY

PR62's original 96d98f8 documents asserted nonexistent review/integration artifacts and failed CI because NEXT_SESSION's bundle copy differed. Corrected at 95e9476 with a timestamped factual inventory; historical lower sections retained. Main's existing ONEFILE/manifest remain protected V5 artifacts. V7 upload uses a clearly versioned alternative in the V7 docs worktree. Reports199–202 and research packets are historical context, not current gates.

## 5. CLAIMED BUT NOT FOUND

- Objects e23d978,47820a8,c530f60,70b198d,f5a3a7f,d5b8f9e: absent locally; GitHub commit API returned HTTP422 for every SHA.
- Local/live remote branches integration/v6-critical-first and docs/v6-audit: not found.
- Recursive search including ignored worktrees and kcs-v6-docs: no progress_203 or KCS_V6_CROSS_PR_ADVERSARIAL_AUDIT.md. V7 did not manufacture either artifact. Report204 is explicitly requested by the user, not an assertion that203 exists.
- Incorrect PR mapping corrected:47 velocity,48 focus token,49 graph presentation,50 public-controls tests,51 round2 docs,57 easing presets,59 adversarial velocity.
- Missing SHAs do NOT prove missing code: actual PR57 already contained the segment-preset implementation at startup.

## 6. BLOCKED / UNKNOWN / APPROVAL-GATED

1. Malformed KCS temporal-handle/control-point shapes can be admitted and evaluate to NaN (reviewer reproduced). Tightening previously accepted/restored project shapes needs a compatibility/recovery decision; no silent clamp, fallback or migration added.
2. Existing inherited orphan-incoming Lottie timing can influence the next handle-less segment; PR63 deliberately preserves all motion output. Separate mapping-policy investigation, not hidden in a diagnostics patch.
3. Autosave restore rejection's console-only visibility is a product UX decision. Accepted-but-unsavable imports are already surfaced by quota/retry/export guards; no unproven data-loss/storage-rewrite claim.
4. Linux visual baselines absent; no cross-platform pixel or EBU-conformance certification. Existing k5 unused-import lint warning remains.
5. F5b speed gestures, markers/persistence, time-stretch, palette shortcuts, new serialized property types require separate product approval. No dead-code hit-testing utility was built without a consumer.
6. Merge/close/release/tag/version/deployment/cleanup remain unauthorized. No persistent unattended overnight queue is claimed.

## Architecture understanding (A–M)

A evaluator: defaults.interpolateChannel/applyEasing/solveCubicBezier and evaluateTransform/evaluateFrame. B authored state: Track.channels/PropertyKeyframe, legacy migration preserved. C temporal precedence: HOLD > complete neighboring pair > explicit/derived control points > named. D graph: TemporalGraphPanel/InteractiveCubicBezierEditor, velocityMath derived read. E timeline: SequencerTimeline/TimeRuler/useTimeline. F history: useHistory parts+tracks snapshots, one logical action/undo. G persistence: useSerialization/getPersistenceSafety and existing lock/CAS authority. H boundaries: importValidation/fileAdmission/importDispatch. I OGraf: compiler/import/diagnostics/runtimeTemplate plus parity tripwires. J Lottie: shared temporal mapper for scalar/mask geometry. K SVG: matte/layerMasks/shapeGeometry, no alternate compositor. L UI/a11y: theme/focus/shortcuts/modal authorities. M QA: unit, behavior Chromium, opt-in platform screenshots, narrow release gate, direct exact-head CI.

Research read without execution/code copying: original targeted-audit/revalidation packets, RESEARCH_PROVENANCE, reports142/144–147/196/199–202 and current blueprints. A specifically DeepSeek-attributed original V6 audit file was not established. AGPL/study-only references were technique-only; historical reports do not confer current proof.

## Master task graph and outcomes

Common DoD: source-grounded scope, real behavior proof, focused regressions, project types/lint/build, relevant browser/compatibility gates, exact SHAs/CI, independent high-risk review and factual documentation. No unauthorized Git/product action. Each row inherits this DoD.

| ID / priority | Objective, evidence and user impact | Scope / dependency | Risk / effort | Worker / parallel safety | Acceptance / approval / outcome |
|---|---|---|---|---|---|
| V7-00 P0 | Replace false V6 history with Git/source truth | ledger + PR inventory; none | low / M | Sol + scoutsA/B; yes | six categories, exact heads; DONE |
| V7-57 P0 | Fix TS2304/ReferenceError armChannel; preserve real preset authoring | useTimeline + K1/provider tests;00 | high undo/space / M | localA/recovery/G; exclusive e1 | evaluated12.916193, oneundo/redo, first/middle/last/HOLD/cp; DONE, reviewerE READY |
| V7-58 P0 | Correct exit-cusp sign and nonrepresentable velocity scale | speedInverse + tests;00 | high math / M | localB; exclusive math | analytic singular/flat/range/clamp/signed/roundtrip; DONE, reviewerD READY |
| V7-55 P0 | Align inverse spec with actual domain/eligibility/units | existing spec;58 | medium / S | localB; independent ofA | E=y(x^-1(u)), signed units, no UI claim; DONE |
| V7-60 P0 | Truthful badge/AT contract, remove obsolete hidden-text assertion | existing badge + E2E;00 | medium / S | localC, small Sol cleanup; separate tree | actual six-state browser matrix, accessible names/keyboard; DONE |
| V7-62 P1 | Remove false history and repair mirror/CI credibility | docs only;00 | low / M | localC; separate tree | consistency + exactCI; DONE |
| V7-DOMAIN P1 | Audit caps/quota/x trust, avoid unsafe incidental migration | existing boundaries;00 | high data / M | reviewerD; read-only | reproduced risk/guard evidence; DONE audit, policy changes gated |
| V7-F P2 | Report incomplete Lottie easing truthfully, improve fixtures | mapper diagnostics/tests/docs; P0 stable | medium / M | localF; independent tree | 14 scene outputs identical, seven fixtures/browser report; DONE, reviewerI READY |
| V7-QA P1 | Exact-content cross-feature certification |12-head candidate;57/58/60/F | medium / L | localH/J/K, serialize heavy QA | full2967 units,466 browser,visual/release/CI; DONE |
| V7-DESIGN P3 | Keep unapproved interaction/schema ideas gated | existing blueprints; P0 stable | product / S | Sol decision; yes | no dead code/new semantics; DOCUMENTED, APPROVAL REQUIRED |
| V7-HANDOFF P4 | Truthful report204 + current versioned upload | docs tree; actual outcomes | low / M | Sol checkpoint | actual paths, no stale canonical overwrite; DELIVERED WITH DOCS COMMIT |

## Final exact-head QA

All rows certify b6c2d78d3f96e10fa9df2d21d0d13cde2595d586, not main.

| Gate | Result |
|---|---|
| Project TypeScript `tsc -b --force` | PASS; noEmit alone is not a referenced-project type gate |
| Lint / production build / OGraf fixture | PASS; one pre-existing unused-import warning |
| Full Vitest | 199 files /2967 passed |
| Full Chromium |466/466 passed, workers1/retries0, first attempt,14.8min |
| Actual npm qa:visual |2/2 passed against existing win32 baselines; no regeneration |
| Actual npm qa:release |2/2 passed, retries0, matching printed candidate SHA |
| State consistency |68/68 PASS |
| Existing CI workflow single dispatch |39509846405 success; exact final head |

The initial actual runners FAILED because the new worktree had only generated node_modules caches, not installed packages. Equivalent subcommands were not accepted as the actual runner pass. K ran npm ci (298 packages,18s), preserving package/package-lock SHA256s, then BOTH real npm commands passed on unchanged head. No product fix or new dependency was necessary; each worktree must satisfy its install prerequisite.

RED/GREEN packets and raw logs are in OS TEMP: kcs-v7-A-result, C-result, D-review, E-review, F-result, I-review, H-assembly, J-final-qa, K-runner-proof and kcs-v7-final-J/. B/G initially returned in-flight; their missing completion packet was not invented. Actual commits/direct probes/CI results and final QA close the deliverable.

Manual evidence: F25 linear25 versus EaseInOut12.916193 with actual renderer and undo (A); live badge authority matrix (Sol); final-candidate visible Lottie report0 blockers/3 correct warnings and Cancel (Sol). Confirmed Lottie screenshot: `C:/Users/ertugrul.ak/AppData/Local/Temp/omp-sshots-15ae318a31de0038.webp`. F's guessed PNG paths were absent; J's second screenshot did not visibly show the report, so neither is cited as that visual proof.

## Local execution and resource-policy exception

- OMP18.11.0; actual worker model pennyroyal-eng131/pennyroyal, existing LAN Qwen Flash-Next MoE NVFP4 at172.16.0.131:8001. Peak two simultaneous local worker processes; heavy full QA serialized. Standard cloud-routed task agents were not used.
-15 task CLI process starts including one cancelled J and its resumed process; two CLI launches were rejected before work (unsupported python tool, interactive-only restore), plus two small local capability smokes. Saved sessions allow conversation resume; no claim that old background jobs were restored.
- One server-wide load sample:5 active requests,0 queued,96.8 tokens/s,token usage0.56. Other sessions shared the server; not per-worker throughput/GPU proof. No third/fourth worker experiment.
- **Exception:** OMP auto-thinking made18 failed opencode-go auxiliary attempts across nine saved pre-containment sessions (401/error,0 reported tokens/cost); worker assistant responses stayed Qwen and zero successful cloud auxiliary output was observed. Earlier no-session invocations cannot be quantitatively audited. No external billing guarantee.
- Containment: active J stopped; fixed `--thinking high` smoke then actual resume/K used explicit thinking without global changes. K saved metadata confirms high and zero auxiliary calls; no additional auxiliary calls appeared in the resumed J record. `--restore` failed in print mode; `--resume` was the actual supported conversation continuation.
- Fresh reviewers did not explicitly read implementation packets, but automatic worktree Mnemopi recall exists; perfectly blind review isolation is not claimed. Analytic and fresh-process execution evidence is stronger than repeated verdict text.

## Safety / protected state / handoff

Final audit23:04:11Z: canonical21 dirty/untracked paths all hash-identical to startup and porcelain-identical; main stillb6b3c2c. All42 original worktrees remain;45 total after adding only v7-director/v7-lottie-diagnostics/v7-candidate. UI5173 PID18344 and API5000 PID4288 unchanged;4312 and own QA ports off. No user project mutation, canonical DB operation, release/tag/version/merge/cleanup performed.

Three historical external QA folders were found under `C:/Users/ertugrul.ak/Desktop/KCS/_archive_before_upload_cleanup_20260916-122257/`, not the stale direct-Desktop paths. They were not moved. ograf-graphics was not located in the searched Desktop/Documents/Downloads scope; no claim it was deleted by V7. Pre-existing ignored Playwright output directories were not hashed before reused-tree tests, so preservation of every old ignored QA file is not proven; final outputs used unique TEMP/new-tree locations.

Final deliverables are in `.worktrees/v7-director`: `reports/progress_204_autonomous_director_v7.md`, `chatgpt_handoff/latest/CHATGPT_UPLOAD_ONEFILE_V7.md`, `chatgpt_handoff/latest/manifest_V7.txt`, and this ledger. The protected canonical V5 upload/manifest remain unchanged. No background overnight execution is claimed after handoff.
