# Progress 144 — H3 oxlint 1.85 triage (audit only, no change)

Milestone H, task H3. **No repository change**: the audit ran the candidate linter from the npx cache,
which installs nothing into the project. The installed linter stays `oxlint` 1.74.0 (specifier
`^1.71.0`, lockfile 1.74.0) and the lint run stays clean.

## 1. How the warnings were obtained

```
npx oxlint --version                    → 1.74.0 (installed, the version CI and the release use)
npx -y oxlint@1.85.0 src                → the candidate linter, run read-only from the npx cache
```

`package.json`, `package-lock.json` and `.oxlintrc.json` are untouched: the audit needed the warning
list, not the upgrade. The prior measurement (`reports/progress_130_dependency_maintenance_option_b.md`
§limits) reported "33 new rule warnings" from three rule families; this audit re-measured the exact
sites and classified them.

## 2. The warnings, by rule

| Rule | Count | What it flags |
|---|---|---|
| `react(refs)` | 17 | accessing `ref.current` during render |
| `react(set-state-in-effect)` | 14 | calling `setState` synchronously inside an effect |
| `react(purity)` | 2 | calling an impure function (`performance.now`) during render |
| `typescript(no-non-null-asserted-optional-chain)` | 1 | `?.…!` — asserting non-null on a value that may be undefined by design |

## 3. Classification

### 3.1 `react(refs)` — 17 sites — **B (rule/style churn against a deliberate pattern)**
Sixteen of the seventeen are the codebase's documented **latest-ref mirror**:

- `src/hooks/useHistory.ts:75,76,81` — `historyRef.current = history`, with the source comment
  *"Mirrors of the latest committed history/index (safe to read in callbacks)"*;
- `src/hooks/useProjectState.ts:10,13` (`tracksRef`/`characterPartsRef`), `src/hooks/usePlayback.ts:21`
  (`fpsRef`), `src/hooks/usePresets.ts:44`, `src/components/Canvas/StageCanvas.tsx:70,71`, and two in
  `src/tests/freeformTangentHistory.test.tsx`.

The pattern exists so callbacks and effects can read the newest value without re-subscribing; the rule
targets exactly it. The seventeenth, `src/components/Inspector/TemporalGraphPanel.tsx:61-63`, reads
`dragDomainRef.current?.min/max` during render to clamp a drag domain — a render-time ref read that only
changes while a drag is in progress (and each change also sets state).

Converting any of these is a refactor across hooks, context and canvas components with real behaviour
risk in the animation core. The task's own rule for that case is to stop and ask, not to do it here.

### 3.2 `react(set-state-in-effect)` — 14 sites — **B (performance advice, not correctness)**
The sites are synchronisation with things outside React: the playback loop
(`usePlayback.ts:34`), the broadcast loop (`useBroadcast.ts:41,80`), the freeform draw overlay
(`useFreeformDraw.ts:156`, `FreeformTangentOverlay.tsx:145`), the autosave restore
(`useSerialization.ts:441`), the dialog's focus/select timing (`NewItemModal.tsx:31`), the bezier
editor (`InteractiveCubicBezierEditor.tsx:64`) and prop→local-state sync in the small input controls
(`SmartHexInput.tsx:27`, `SmartNumberInput.tsx:36`, `TransformInOutPresetCard.tsx:208,268`),
plus `StageCanvas.tsx:75,155`.

The rule's own guidance allows an effect when synchronising with an external system, which is what
these are. Restructuring them (deriving during render, keying components, moving the state to its
cause) is a per-site design change in the animation core, not a dependency task.

### 3.3 `react(purity)` — 2 sites — **C (small bounded fix)**
`usePlayback.ts:24` and `useBroadcast.ts:196`: `useRef<number>(performance.now())`. The argument is
evaluated on **every** render even though only the first value is kept, so an impure clock call runs
during render. The impact is invisible (the value is discarded), but the rule is correct. Bounded fix:
initialise the timestamp inside the effect that starts the loop.

### 3.4 `typescript(no-non-null-asserted-optional-chain)` — 1 site — **C (small bounded fix)**
`src/tests/trackMutations.test.ts:46`: `next[0].channels?.opacity?.[0].id!`. The `?.` can be
`undefined` by design and the `!` asserts it away; in a test the honest form is to assert the value
first. One line in one test file.

## 4. Verdict: **DEFER** — no change in this milestone

- **31 of 34 warnings are class B**: they flag patterns this codebase uses on purpose, or give
  performance advice for synchronisation effects. Clearing them is a refactor of the hooks, the canvas
  and the inspector — not a lint bump.
- **3 are class C**, but fixing them would **not** make the run clean: 31 class-B warnings would
  remain. A lint run with 31 warnings is not the project's standard, and the only ways to a clean run
  would be a broad refactor or silencing the new rules — which the task explicitly forbids
  ("Do not suppress warnings wholesale. Do not disable broad rules just to get green").
- **Nothing here is a release blocker.** The release is being finalized on a toolchain whose lint run
  is clean, and the 1.85 rules report no user-visible defect: the two purity sites call a clock whose
  value is thrown away, and the one optional-chain assertion is in a test.
- Adopting 1.85 while keeping the rules enabled would *lower* the project's lint floor. Keeping 1.74.0
  keeps it at zero warnings while the new rules get the triage they need.

**Recommended follow-up (its own task, not this milestone):** take the three rule families one at a
time — `react(purity)` first (2 sites, mechanical), then decide per family whether the codebase's
latest-ref mirror is a pattern to keep (with a documented `allow` for those specific call sites) or to
replace, and only then consider the linter bump. That decision needs approval because it either
changes the animation core or narrows a rule.

## 5. State left behind

- `.oxlintrc.json`, `package.json` and `package-lock.json`: **untouched**.
- `chore/oxlint-1-85` was created at `main` (`b4bf3c0`) before the audit concluded; it holds **no
  commits** and can be deleted with approval.
- The lint run on the installed linter remains clean (`npm run lint` → no output).
