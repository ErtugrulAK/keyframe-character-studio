# KCS Development Report — UI Redesign Final Pixel Regression Recovery

Metadata:
- Date: 2026-03-10
- Milestone: KCS UI REDESIGN — FINAL PIXEL REGRESSION RECOVERY
- Branch: `feat/v6-ui-redesign`
- Starting HEAD: `1e8119022d480d38036dd0f7c8cb596707febbc0`
- Ending HEAD: `1e8119022d480d38036dd0f7c8cb596707febbc0`
- Commit status: No commit — prohibited by task scope.
- Report number: `progress_033.md`

# 1. Executive Summary

The final two Playwright pixel failures were caused by the UI theme changing the established screenshot coordinate frame, not by matte algorithms. The theme forced the header from the established 79px layout height to 56px and the left navigation from 56px to 86px. This moved the stage origin from `(336,79)` to `(366,56)` at the 1280×720, DPR 1.25 test viewport. Fixed probes consequently sampled different rendered regions. The theme now preserves the established 79px header and 56px navigation geometry; the canvas backdrop also matches the core checkpoint. No renderer or test thresholds changed.

# 2. Original Objectives

In scope: reproduce V-M1 and V-H2, compare against exact V6 core checkpoint `939d6de`, trace coordinate spaces, correct the UI boundary, stress-test both cases, run full regression, and document evidence.

Out of scope: matte algorithm changes, threshold/tolerance changes, retries, sleeps, skipped tests, test hiding, branch operations, commits, pushes, and unrelated roadmap work.

# 3. Problems Discovered

- V-M1 symptom: transparent probe expected green `<45`, received `45` deterministically on the redesigned branch. Root cause: stage origin shifted by theme layout rules; screenshot-space sampling no longer targeted the intended project-space region.
- V-H2 symptom: full-suite runs previously reached the threshold boundary. Root cause: the same shell coordinate shift altered the sampled text matte region. Independent post-fix values were stable `aLeft=199`, `bLeft=93`.
- Core comparison: both focused tests passed on an archive of exact checkpoint `939d6de`; core V-H2 reported `aLeft=199`, `bLeft=93`. Therefore the failures were UI-redesign coordinate presentation regressions, not previously hidden renderer failures.

# 4. Files Created

- `reports/progress_033.md`: permanent recovery record required by the reporting policy.

# 5. Files Modified

- `src/kcsEditorTheme.css`: restored the established header and left-navigation dimensions while retaining visual-only styling.
- `src/components/Canvas/StageCanvas.css`: restored the V6 core pasteboard background values; authored SVG/matte rendering was not changed.


# 6. Architecture Overview

```text
SceneData/localStorage
        ↓
AnimatorContext → StageCanvas → SVG masks/images/text/geometry
        ↓              ↓
  UI panels       screenshot pixel probe
```

The recovery changes stay at the CSS shell/canvas boundary. `AnimatorContext`, domain hooks, SVG renderer paths, mask composition, serialization, playback, and history remain authorities.

# 7. Data Model Changes

None. Authored SceneData, evaluated state, mask/matte values, animation, sequences, and serialized localStorage payloads are unchanged.

# 8. Coordinate Space Model

The E2E helpers accept project/world coordinates, then call `svg.createSVGPoint()` and `getScreenCTM()` to convert them into viewport/screenshot pixels. PNG sampling is therefore screenshot pixel space after a project/world → viewport conversion; it is not a hard-coded project-space pixel lookup.

At the 1280×720 test viewport with DPR 1.25:

- Before recovery theme frame: stage/SVG bounds `(x=366,y=56,w=554,h=344)`.
- Established core frame and after recovery: `(x=336,y=79,w=584,h=321)`.
- SVG has `viewBox` camera coordinates and `preserveAspectRatio="xMidYMid meet"`; the authored stage transform remained `matrix(1,0,0,1,0,0)`.
- `greenAt` rounds the `getScreenCTM()` result and samples the screenshot PNG at that coordinate.

The fix restores the shell geometry rather than altering conversion math or renderer coordinates.

# 9. Component / Module Walkthrough

- `App.tsx` imports the shared theme only.
- `StageCanvas.tsx` remains the existing SVG owner and retains its project-to-screen transform, viewBox, artboard clip, masks, and layer composition.
- `kcsEditorTheme.css` owns presentation tokens and shell styling; it must not own authored renderer semantics.
- E2E `greenAt` helpers remain the behavioral pixel seam.

# 10. Important Code Changes

```css
.header-bar { min-height: 79px; height: 79px; }
.left-sidebar-nav { width: 56px; }
```

The previous redesign values `56px` and `86px` were visually reasonable in isolation but invalid because they changed the established coordinate frame used by browser pixel tests. StageCanvas pasteboard gradients were restored to the core values.

# 11. Public Interfaces

None changed. No exports, props, hooks, types, serialized fields, or runtime APIs changed.

# 12. Algorithms and Geometry

No algorithm changed. Existing mask geometry and compositing remain responsible for alpha/luminance/inversion/gradient behavior. The correction is layout geometry preservation only.

# 13. Interaction / UX Behavior

Before: the professional theme visually tightened the shell but changed header/nav geometry and moved the canvas origin.

After: the professional visual treatment remains, while the header and left navigation preserve the original coordinate frame. Expected workflow is unchanged: users can select layers, inspect masks/mattes, edit timeline/graph controls, and render the same authored scene.

# 14. Design Decisions

- Decision: restore established shell dimensions instead of changing test expectations. Reason: tests correctly convert project/world coordinates through actual SVG geometry, and core comparison proved the renderer output is correct. Alternative rejected: changing thresholds or hard-coded samples.
- Decision: restore the core canvas backdrop values. Reason: no need to alter pixel-sensitive pasteboard rendering while recovering a shell regression. Alternative rejected: compensating matte output with renderer changes.

# 15. Invariants That Must Be Preserved

- SVG `viewBox`, `preserveAspectRatio`, `getScreenCTM`, project output origin, and artboard clip remain authoritative.
- Matte alpha polarity, luminance, inversion, strength, feather, gradient, and compositing order remain unchanged.
- UI CSS must not alter authored renderer semantics or coordinate conversion assumptions.
- Saved projects, localStorage migration, undo/redo, playback, and serialization remain compatible.
- Pixel thresholds remain unchanged.

# 16. Testing and Verification

- V-M1 independent, no retries: PASS after fix.
- V-H2 independent, no retries: PASS after fix; `aLeft=199`, `bLeft=93`.
- V-M1 stress: PASS — 20/20 with `--retries=0 --repeat-each=20 --workers=1`.
- V-H2 stress: PASS — 20/20 with `--retries=0 --repeat-each=20 --workers=1`.
- Exact V6 core archive focused comparison: PASS — 3 tests, including V-M1 and V-H2.
- Two matte files command was started with 108 tests but hit the command timeout after substantial progress; the full suite below is the authoritative complete gate.
- `CI=true npm run test:e2e`: PASS — 252/252, 0 failed.
- `npm run qa:v6`: PASS — 3/3.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with existing warning at `src/context/AnimatorContext.tsx:655:14` (`react(only-export-components)`).
- `npm test`: PASS — 100 files, 1,421 tests.
- `npm run build`: PASS; existing Vite chunk-size warning remains.
- `git diff --check`: PASS.

# 17. Manual QA Results

- 1920×1080: PASS — canvas remains dominant; no page overflow observed.
- 1440×900: PASS — canvas, Inspector, Timeline, and shell remain visible; no page overflow observed.
- 1366×768: PASS — compact desktop surface remains usable; no page overflow observed.
- Console errors: PASS — none observed in the browser audit session.
- Graph Editor and Masks/Track Matte UI: PASS — existing controls and disclosures remained present during prior representative browser inspection.

# 18. Regression Risk Assessment

LOW. Only CSS layout dimensions and pasteboard presentation changed; all 1,421 Vitest tests, V6 QA, full 252-test Playwright suite, TypeScript, lint, build, and diff checks pass. The existing lint warning and bundle-size warning are unrelated and remain documented.

# 19. Performance Considerations

No runtime algorithm, render loop, React state, or geometry computation changed. CSS-only adjustments have no measured runtime cost. No benchmark was added or required.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

No public API, serialized data, browser contract, React contract, TypeScript contract, or saved-project compatibility change. The correction explicitly preserves the V6 core screenshot coordinate frame across the tested Windows/Chromium environment.

# 22. Known Limitations

- Full Playwright `track-matte.spec.ts` is a slow file; the complete gate passed in 6.1 minutes.
- Existing lint and Vite chunk-size warnings remain outside this milestone.
- Browser manual QA did not perform a new screenshot review of every possible dense project state; existing representative states plus the complete E2E suite were used.

# 23. Technical Debt

The shell currently has an implicit coordinate-frame contract with browser pixel probes. Future shell changes should encode or document this contract near layout ownership and should validate stage bounds at the pixel-test viewport. This milestone does not add a new abstraction because the existing SVG `getScreenCTM()` seam is correct.

# 24. Git Summary

- Branch: `feat/v6-ui-redesign`
- Starting/ending HEAD: `1e8119022d480d38036dd0f7c8cb596707febbc0`
- `origin/feat/v6-ui-redesign`: unchanged at starting HEAD.
- `main` and `origin/main`: unchanged at `8024d4f29e17623bdc0efda31e9e4332b92460b1`.
- Working tree: intentional uncommitted changes only (`src/kcsEditorTheme.css`, `src/components/Canvas/StageCanvas.css`, and `reports/progress_033.md`).
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.

# 25. Updated Project Tree

```text
src/
├── kcsEditorTheme.css              [modified]
└── components/Canvas/
    └── StageCanvas.css             [modified]
reports/
└── progress_033.md                 [new]
```

# 26. Self Review

Good: diagnosis used an exact core archive, reproduced the failures deterministically, measured DPR and stage geometry, corrected the CSS boundary, and passed the full 252-test browser gate without weakening assertions.

Could improve: add a dedicated stage-bounds contract assertion to prevent future shell geometry drift.

Uncertainty: browser manual console observation is session-scoped; automated full E2E is the stronger regression evidence.

Score: 9/10 — complete and evidence-backed, with the existing warnings and future layout-contract debt documented.

# 27. Next Recommended Task

Run one consolidated UI user acceptance QA on `feat/v6-ui-redesign`.

# 28. Project Status

Final pixel recovery complete. UI redesign behavior is ready for consolidated user acceptance QA. Main remains untouched; no commit or push was performed by this milestone.

# 29. AI Development Notes

The browser pixel seam is intentionally world/project-coordinate based and converts through the live SVG CTM. Fixed shell dimensions are therefore part of the observable rendering contract even when the redesign is nominally visual-only. The renderer and mask authorities were inspected but not changed. Useful reproduction commands are the exact V-M1/V-H2 selectors with `--retries=0 --repeat-each=20 --workers=1`.

## DO NOT CHANGE CASUALLY

- Do not change header/navigation dimensions without checking stage bounds and pixel probes.
- Do not compensate shell coordinate shifts inside matte algorithms.
- Do not weaken `<45`, `>150`, or other pixel assertions.
- Do not replace `getScreenCTM()` conversion with hard-coded screenshot offsets.
- Do not alter canonical SVG mask/filter/compositing semantics for UI styling.
- Do not touch `.hermes/desktop-attachments/`.

# 30. Lessons Learned

Visual shell CSS can be a rendering regression when tests intentionally sample screenshot pixels through live stage geometry. Exact pre-redesign comparison is faster and safer than guessing between renderer and test causes. Preserve established coordinate frames first; refine color, borders, and density within that frame.
