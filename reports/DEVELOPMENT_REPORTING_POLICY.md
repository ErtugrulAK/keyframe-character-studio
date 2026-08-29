# KCS Permanent Development Reporting Policy

Status: Canonical repository policy
Authority: This file is the single source of truth for permanent KCS development reports.
Scope: Meaningful implementation milestones and other substantial engineering packages in Keyframe Character Studio.

## 1. Purpose

Every meaningful implementation milestone MUST leave a durable engineering record in `reports/`. The report is the primary technical record of the work. It MUST be understandable months later without chat history, terminal scrollback, or previous agent context.

The report records the problem, objective, architecture, state ownership, coordinate spaces where relevant, implementation decisions, verification evidence, limitations, risks, and future cautions. It is not a shallow changelog and it MUST NOT be replaced by a detailed terminal response.

This policy does not authorize product changes, Git history changes, commits, pushes, branch operations, or regression shortcuts. Existing `AGENTS.md`, `.agents/AGENTS.md`, and `.omp/RULES.md` remain authoritative for safety and approval boundaries.

## 2. Canonical location and numbering

Reports MUST be stored directly under `reports/` using:

```text
reports/progress_XXX.md
```

Before creating a report:

1. Inspect `reports/`.
2. Find the highest existing `progress_XXX.md` number.
3. Allocate the next sequential number.
4. Never overwrite an existing report.
5. Never reuse a number, including after an abandoned attempt.

The policy file itself is `reports/DEVELOPMENT_REPORTING_POLICY.md` and is not part of the numbered sequence. A missing `reports/` directory means the first report is `progress_001.md`.

## 3. When a report is required

A numbered report MUST be created for every meaningful implementation milestone, including a feature package, approved bug-fix package, architecture change, renderer/geometry change, interaction/UX pass, persistence or compatibility change, and substantial validation or migration package.

A report is part of milestone completion. A milestone is not complete until the report exists, has the required sections, and accurately records the final Git and verification state.

A report is not required for trivial typo-only edits, generated artifacts, or a one-command diagnostic unless the task explicitly requests documentation. When uncertain, create the report; do not silently omit the technical record.

## 4. Source-of-truth and evidence rules

Reports MUST be based on the current repository, current tests, current configuration, and actual command output. Follow the repository source-of-truth order:

1. Current working source code.
2. Current tests and E2E tests.
3. Current types and domain models.
4. Current package and tool configuration.
5. Current documentation.
6. History and historical notes.

Historical claims MUST be labeled `UNVERIFIED` when current evidence cannot prove them. Reports MUST distinguish `PASS`, `FAIL`, `PARTIAL`, and `NOT TESTED`. Never claim a test, browser scenario, measurement, Git action, or compatibility result that was not actually executed or observed.

## 5. Required report structure

Every numbered report MUST use this structure. Sections that do not apply MUST say `Not applicable` and explain why; they MUST NOT be silently omitted.

```markdown
# KCS Development Report — <Milestone Name>

Metadata:
- Date
- Milestone
- Branch
- Starting HEAD
- Ending HEAD
- Commit status
- Report number

# 1. Executive Summary
# 2. Original Objectives
# 3. Problems Discovered
# 4. Files Created
# 5. Files Modified
# 6. Architecture Overview
# 7. Data Model Changes
# 8. Coordinate Space Model
# 9. Component / Module Walkthrough
# 10. Important Code Changes
# 11. Public Interfaces
# 12. Algorithms and Geometry
# 13. Interaction / UX Behavior
# 14. Design Decisions
# 15. Invariants That Must Be Preserved
# 16. Testing and Verification
# 17. Manual QA Results
# 18. Regression Risk Assessment
# 19. Performance Considerations
# 20. Dependencies
# 21. Compatibility
# 22. Known Limitations
# 23. Technical Debt
# 24. Git Summary
# 25. Updated Project Tree
# 26. Self Review
# 27. Next Recommended Task
# 28. Project Status
# 29. AI Development Notes
## DO NOT CHANGE CASUALLY
# 30. Lessons Learned
```

### 5.1 Executive Summary

State what changed, why it changed, user impact, architectural impact, and completion state.

### 5.2 Original Objectives

State the original task, in-scope work, out-of-scope work, and explicit exclusions. Do not expand scope retroactively.

### 5.3 Problems Discovered

For every important problem record symptom, reproduction, root cause, affected subsystem, severity, and status.

### 5.4 Files Created

For every new file record purpose, responsibilities, why it exists, dependencies, and important notes.

### 5.5 Files Modified

For EVERY intentionally modified file record previous responsibility, change, reason, behavioral impact, affected callers/consumers, and regression risk. Include test and configuration files when modified.

### 5.6 Architecture Overview

Explain module relationships, dependency flow, data flow, and control flow. Use compact ASCII diagrams where they clarify ownership or sequencing.

### 5.7 Data Model Changes

Separate authored/serialized state, derived/evaluated state, and transient editor/UI state. Document SceneData, transforms, Boolean relationships, masks, sequences, animation, migration, and serialization effects when relevant.

### 5.8 Coordinate Space Model

This section is mandatory for milestones affecting Canvas, transforms, selection, Boolean geometry, masks, hit testing, viewport, dragging, or animation. Define object-local, parent-local, world/canvas, and viewport/screen spaces. Explain every conversion boundary and the invariants between render geometry, selection bounds, hit testing, marquee, dragging, Inspector values, evaluation, undo/redo, and serialization.

### 5.9 Component / Module Walkthrough

For each materially modified TypeScript or TSX module, explain purpose, exports, state, props, important helpers, event flow, algorithms, and interactions with other modules. Do not document irrelevant unchanged functions.

### 5.10 Important Code Changes

Include only concise snippets that materially explain a changed contract or algorithm. Do not dump complete existing files; Git history preserves full source. A small new utility MAY be shown in full when that is genuinely useful.

### 5.11 Public Interfaces

Document changed or new exported functions, hooks, React components, and TypeScript types/interfaces/enums. Include arguments/props, returns, side effects, and usage expectations.

### 5.12 Algorithms and Geometry

For significant algorithms document input, output, steps, meaningful complexity, edge cases, assumptions, and alternatives considered. Cover Boolean geometry, bounds, masks, transforms, interpolation, selection, and hit testing when applicable.

### 5.13 Interaction / UX Behavior

For every changed interaction document BEFORE, AFTER, and EXPECTED USER WORKFLOW.

### 5.14 Design Decisions

For each significant decision document Decision, Reason, Alternatives, Trade-offs, and Future implications.

### 5.15 Invariants That Must Be Preserved

List actual architectural and behavioral rules future work must not accidentally violate. Include canonical authorities, compatibility rules, history semantics, and coordinate contracts where applicable.

### 5.16 Testing and Verification

Record EVERY verification actually executed, separated into TypeScript, Vitest/unit, Playwright/E2E, manual browser verification, and Git validation. Include exact commands, paths, counts when known, pass/fail state, and scenarios. Record environment/tooling workarounds and failures instead of hiding them.

### 5.17 Manual QA Results

Use only `PASS`, `FAIL`, `PARTIAL`, or `NOT TESTED`. Include unresolved reproduction steps and the exact manual surface inspected.

### 5.18 Regression Risk Assessment

Rate meaningful risks `LOW`, `MEDIUM`, or `HIGH` and explain the evidence and affected contracts.

### 5.19 Performance Considerations

Document actual implications only: render frequency, geometry recomputation, pointer hot paths, React rerender risk, and caching/memoization. Do not invent benchmarks.

### 5.20 Dependencies

For dependency changes record package, version when known, purpose, runtime/dev classification, reason required, and alternatives. If none, write `No dependency changes.`

### 5.21 Compatibility

Document relevant React, TypeScript, Vite, Node, browser, Windows, serialization, saved-project, and warning implications. Separate verified facts from inference.

### 5.22 Known Limitations

List all known limitations remaining in the delivered scope.

### 5.23 Technical Debt

List intentional postponements, their reason, and the condition for revisiting them.

### 5.24 Git Summary

Document branch, starting HEAD, ending HEAD, origin/main, working-tree status, commit status/hash/message, push status/target, and changed files. When prohibited by scope, use exactly:

```text
Commit: NO — prohibited by task scope.
Push: NO — prohibited by task scope.
```

### 5.25 Updated Project Tree

Show only the relevant project tree. Do not include `node_modules`, `dist`, or generated artifacts. Mark changed and new files.

### 5.26 Self Review

State what is good, what could improve, uncertainty, a score out of 10, and the reason. Do not automatically give 10/10.

### 5.27 Next Recommended Task

Recommend EXACTLY ONE next task. Do not perform it in the reporting task.

### 5.28 Project Status

Record only reliable current milestone, completed work, remaining milestone work, and QA stage. Do not invent completion percentages without an authoritative roadmap.

### 5.29 AI Development Notes

Record assumptions, architecture knowledge, fragile areas, state ownership, coordinate rules, serialization implications, animation implications, useful test locations, reproduction procedures, TODOs, risks, and refactoring opportunities. Include a clearly labeled `## DO NOT CHANGE CASUALLY` subsection listing load-bearing behavior.

### 5.30 Lessons Learned

Summarize what was learned, clearer abstractions, recurring bug patterns, architecture improvements suggested, and safer/faster practices for future work.

## 6. Git and scope safety

Creating a report or updating this policy does not authorize commit, push, branch, merge, rebase, reset, stash, clean, or unrelated source changes. Preserve all repository safety gates. Before and after report creation, record branch, HEAD, origin/main, ahead/behind, staged/unstaged changes, and untracked files when the task scope requires it.

Existing unrelated artifacts under `.hermes/desktop-attachments/` MUST NOT be touched. Unexpected working-tree changes outside explicitly known task scope MUST stop the task and be reported.

The report MUST identify intentional uncommitted changes accurately. A documentation task MUST NOT normalize, stage, revert, or hide product changes from a prior approved task.

## 7. Milestone workflow integration

The canonical `/milestone` workflow MUST read this policy during discovery and MUST create the next numbered report during final scope audit before declaring the milestone complete. The workflow MUST continue to enforce focused validation, approval boundaries, no automatic commit/push, and the appropriate full-regression gate.

The `/milestone` terminal response remains short. Detailed engineering evidence belongs in the numbered report.

## 8. Final chat contract

After a meaningful milestone report is created, the final chat response SHOULD contain only:

```text
Task completed: <short description>
Report: reports/progress_XXX.md
Tests: <short accurate status>
Commit: <hash only when explicitly requested and created, otherwise NO COMMIT>
```

Do not paste the full report into chat. If the task is blocked before report creation, state the blocker instead of claiming completion.

## 9. Quality gate

Before final response, verify:

- The policy file remains the single canonical policy.
- The numbered report exists at the next sequential number.
- No existing report was overwritten.
- All required report headings exist.
- Every claim matches current source or actual command output.
- Git status and scope are accurate.
- No prohibited Git operation occurred.
- Tests are reported exactly as run.
- No unrelated product work was performed.

A report that fails this gate is incomplete even when implementation or tests otherwise pass.
