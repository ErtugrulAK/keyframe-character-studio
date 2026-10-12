# OMP final response — manual QA round 1 remediation (PART 2: findings G–J)

Status: **complete, committed, pushed, PR opened, preview switched. Not merged.**

## What was delivered

Ten manual-QA findings were remediated on `fix/manual-qa-round1-remediation`. PART 1 (A–F) was
already committed when this task started; PART 2 fixed G–J in four logical commits:

- `9774729 fix: bind timeline property rows to their owning layer` (G)
- `05f3130 fix: suppress native sequence context menu` (H)
- `aba0b05 fix: lighten the canvas selection frame to a paired outline` (I)
- `18b4aca feat: promote the top authoring toolbar` (J)

G: every timeline property row now declares its owning layer (block + headers carry the owner part id,
the Transform header names the owning layer, the property block hangs off its layer row on a nesting
rail, and the disclosure headers are real buttons with `aria-expanded` and Enter/Space). A group
child's properties stay owned by the child.
H: a sequence tab prevents the browser's native context menu and does nothing else; the prevention is
scoped to the tab, so click, double-click rename and the close control are untouched.
I: the selection frame is now a paired light/dark outline of reduced thickness (new
`--kcs-selection-keyline` token, thin dark core, accent dash on top) instead of a wide black halo; it
reads over light and dark artwork and no per-frame pixel sampling was added.
J: the redundant floating coordinate-plane toolbar is removed and the docked strip is the one
authoring toolbar — tools, creation, paint, Boolean, grouping, arrange and view controls, every one on
an authority that already existed. The Boolean operations and Group/Ungroup are always visible and
disabled when the current selection cannot use them, so the strip never reflows around the selection.

## Validation (head `18b4aca`)

`tsc`, lint, `npm test` (147 files / 2,262 tests), build, `validate:ograf`, `qa:release` (2), `qa:v6`
(3), `npm run check`, state consistency (38 checks), `npm audit` (0 vulnerabilities), `git diff
--check` and the FULL Chromium suite with `--retries=0`: **344 passed, 0 failed, 0 flaky**. No
assertion was weakened and no retry was added. The specs that drove the removed floating toolbar were
migrated to the docked strip so their coverage survived.

## Pull request

**#9 — OPEN, not merged** (`https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`), base
`main`, head `18b4acac0538c7a3ef9732e190ccb7e2f7b9b566`, mergeable MERGEABLE, CLEAN.
CI **CI Pipeline** run `38246227512` (pull_request) — **success**.

## Live surfaces

The 5173 QA preview was switched from the canonical repo (listener pid 34860) to this worktree
(`npx vite --host --port 5173`, vite listener pid 33512, service wrapper pid 40896); 5173 answers 200
and serves this branch's modules, on branch `fix/manual-qa-round1-remediation` with HEAD equal to the
PR head. **API 5000 (pid 8872) was never stopped or restarted** and still answers 200.

No merge, no tag, no release and no npm publication happened. The user's retest against 5173 is the
merge gate; the exact retest list is in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.
