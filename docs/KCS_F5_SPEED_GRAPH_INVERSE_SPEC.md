# F5 — Speed-Graph Inverse Mapping: Mathematical Specification

Status: **specification only** — explicitly NOT an approval to implement interactive
inverse mapping (V6+ roadmap gate; round-1 blueprint §"explicitly not planned").
Companion to Round-2 blueprint F5. Inputs: `applyEasing`/`interpolateChannel`
(`src/utils/defaults.ts`), `channelVelocityAt` (`src/utils/velocityMath.ts`, PR #47),
`bezierIn`/`bezierOut` temporal handles (`src/types/animator.ts`),
`TemporalGraphPanel` (presentation-only speed mode, PR #49).

## 1. Forward model (the authority, restated exactly)

For one segment between keyframes $k_0=(t_0,v_0,\text{out})$ and $k_1=(t_1,v_1,\text{in})$,
$\Delta t=t_1-t_0>0$, local time $u=(t-t_0)/\Delta t\in[0,1]$:

$$v(t)=\mathrm{lerp}(v_0,v_1,E(u)),\qquad u=x(s),\quad E(u)=y(s)=y\!\left(x^{-1}(u)\right)$$

$E$ is the $y$-coordinate evaluated at the parameter whose $x$ equals $u$ — a
parametric inverse, NOT the quotient $y(s)/x(s)$ (V6 correction; the earlier
shorthand on this line was wrong and is retracted). Sanity anchor: the
Ease-In-Out preset $(0.42,0,0.58,1)$ at $u=0.5$ gives $s=0.5$ and $E=0.5$ —
the value-graph curve passes through its own midpoint, not $1$.

with (P0=(0,0), P3=(1,1), $x_1=h_{out}.x, y_1=h_{out}.y, x_2=h_{in}.x, y_2=h_{in}.y$):

$$x(s)=3(1-s)^2 s\,x_1+3(1-s)s^2 x_2+s^3,\qquad y(s)=3(1-s)^2 s\,y_1+3(1-s)s^2 y_2+s^3$$

Velocity as measured by the shipped forward helper (`channelVelocityAt`, central
difference of the authority — consistent with this model to $O(\epsilon^2)$):

$$V(t)=\frac{v_1-v_0}{\Delta t}\,E'(u),\qquad E'(u)=\frac{y'(s)}{x'(s)},\quad s=x^{-1}(u)$$

Endpoint slopes (limits; used below):
$E'(0)=\lim \frac{y'(s)}{x'(s)}\big|_{s\to0}=\frac{3y_1}{3x_1}=\frac{y_1}{x_1}$ and
$E'(1)=\frac{3(1-y_2)}{3(1-x_2)}=\frac{1-y_2}{1-x_2}$.

Degenerate cases from the authority, not from this spec:
- `hold`: `applyEasing` returns 0 for the whole span → $v\equiv v_0$, $V\equiv0$, step at the boundary.
- duplicate/zero-duration: `interpolateChannel` returns `prev.value` — no curve exists.
- outside the span: clamped flat, $V=0$.

## 2. The inverse problem and its fundamental limits

**Question (roadmap):** can arbitrary user manipulation of the speed graph be mapped
back losslessly to stored control points? **Answer: NO.** Proofs by counting and by
non-identifiability:

1. **DOF deficit.** Each segment carries exactly 4 scalars $(x_1,y_1,x_2,y_2)$.
   A user-drawn velocity curve is a function on $[0,1]$ — infinitely many degrees.
   An editor must therefore choose a *finite-dimensional gesture* whose target the
   4-parameter family can hit; "arbitrary curve" is not a well-posed input.
2. **Non-identifiability under zero displacement.** If $v_1=v_0$, then
   $V\equiv 0$ for every handle set. Speed edits carry zero information about the
   segment's handles. Any gesture targeting speed on such a segment must be
   disabled (never "approximately applied").
3. **Unrepresentable targets.** `hold` and clamped-flat regions have $V\equiv0$
   *plus* value discontinuity or constancy; no cubic time-map produces a step, and
   no handle set creates velocity where the evaluator holds $E\equiv0$. A visible
   "brushed" speed over a hold would be a lie in storage — prohibited.
4. **Monotonicity cone.** The authority treats $E$ as a function of $u$ and
   Newton-solves $x(s)=u$; this is only valid while $x$ is non-decreasing:
   $x_1,x_2\in[0,1]$ (with the standard $C^1$ caveats at $x_i=0$: $E'(0)\to\infty$
   when $y_1>0,x_1\to0$ — a singularity the UI must bound, not chase). Any inverse
   solution must be projected onto this cone before write; the projection makes
   some target slopes unreachable (e.g. $E'(0)>y_1^{\max}/x_1^{\min}$).

**Feasibility matrix** (segment with $\Delta t>0$, $k=(v_1-v_0)/\Delta t\ne0$, cubic mode):

| Gesture | DOF demanded | Closed-form inverse? | Verdict |
|---|---|---|---|
| Drag segment entry slope (in-handle out.y) | 1 ($E'(0)$) | yes: $y_1=g_0x_1$ | **ALLOWED (subset)** |
| Drag segment exit slope (out-handle in.y) | 1 ($E'(1)$) | yes: $y_2=1-g_1(1-x_2)$ | **ALLOWED (subset)** |
| Set both endpoint slopes | 2 | yes, independent (disjoint parameters) | **ALLOWED** |
| Reshape interior speed profile | ≥3 (needs $x$ too, coupled) | nonlinear least squares with cone projection; residual ≠ 0 in general | DEFER (F5b, behind residual UI) |
| Freehand curve over one segment | ∞ | no (Limit 1) | PROHIBITED |
| Any speed edit on $v_0=v_1$ or `hold` | — | no (Limits 2,3) | PROHIBITED (disabled affordance) |
| Cross-keyframe / multi-segment brush | coupled shared handles | per-segment solvable, intent ambiguous | PROHIBITED v1 |
| Editing $x_1,x_2$ from the speed view | timing warp | changes the value-curve timing too | PROHIBITED from speed view (value graph owns it) |

## 3. The representable editable subset (proposed contract)

Speed editing = **endpoint-slope editing**, x-handles fixed by the value graph.
Given real target slopes $g_0,g_1\in\mathbb{R}$ (dimensionless eased-progress
slopes $E'$; V6 correction — the previous "$\ge0$" was contradictory: negative
slopes are exactly what anticipation writes), the unique preimages are:

$$y_1=g_0\,x_1,\qquad y_2=1-g_1\,(1-x_2)$$

**Four distinct domains (V6 separation — never conflate them):**
1. *Storage / evaluator acceptance*: any finite $x_i,y_i$; monotone-in-time
   behaviour requires $x_i\in[0,1]$ (cone, §2.4) — outside it the Newton solver
   is unreliable, which is a runtime property, not a validation rule.
2. *Curve Studio UI clamp*: the modal clamps authored handles to its own on-screen
   window ($y\in[-1,2]$ visible band) — a UI affordance bound only.
3. *F5 gesture envelope*: $y_i\in[-\alpha,1+\alpha]$, $\alpha=0.5$ — the range a
   slope gesture will write; outside it the inverse CLAMPS AND REPORTS
   (`handlesFromEndpointSlopes` returns `clamped`/`lossy`), never writes silently.
   This is NOT the storage domain: the built-in Elastic preset's y pair
   ($-0.55,\,1.55$) sits outside it and writes through the value graph directly
   (V6 wording correction — one preset with two y-values, not "two presets").
4. *Write-conditioning policy*: the gesture refuses $x_i$ within
   $\tau=10^{-6}$ of the singular endpoints (`out-x-not-representable`); the
   READ side descends by derivative order and reads near-singular handles
   exactly (§1 degenerate classes, PR #58).

Segment coupling at a shared key is natural, not ambiguous: $h_{out}$ of key $k$
owns the entry of the segment that STARTS at $k$; $h_{in}$ of key $k$ owns the exit
of the segment that ENDS at $k$. A preset applies to an OUTGOING segment as one
atomic pair write (PR #57 `applyTemporalHandlesToSegmentMutator` — one gesture,
one document write, one undo entry).

**Units and signs (V6)**: with the SIGNED scale $k=(v_1-v_0)/\Delta t$,
$V=g\cdot k$ [value-units/frame]. On a descending channel ($k<0$) a non-negative
slope $g$ yields negative physical velocity $V$; the speed view renders SIGNED
$V$ (matching `channelVelocityAt`), converts at the authority boundary, and never
stores speed. Overflow and non-identifiability are explicit refusals in the
public API (`overflow-result`, `zero-displacement`, `zero-duration`), never
silent infinities.

## 4. Worked numerical examples

Segment $t_0=0,t_1=10,v_0=0,v_1=100$ → $k=10$ [val-units/frame].

1. **Linear**: $(x_1,y_1,x_2,y_2)=(\tfrac13,\tfrac13,\tfrac23,\tfrac23)$: $E'\equiv1$,
   $V\equiv10$; speed graph is the identity check for the inverse.
2. **easeInOut** $(0.42,0,0.58,1)$: $E'(0)=0/0.42=0$; at $s{=}.5$:
   $y'=6s(1-s)\cdot1=1.5$, $x'=3(1-s)^2(0.42)+6s(1-s)(0.16)+3s^2(0.42)=0.87$
   → $E'(0.5)=1.724$, $V(5)=17.24$; $E'(1)=0$. Matches the PR #47/#49 test bound
   (17.25) — the panel and the spec agree numerically.
3. **Inverse**: user drags entry slope to $V(0)=2$ → $g_0=0.2$ → $y_1=0.2x_1$.
   With $x_1=0.42$: $y_1=0.084$ → storage $h_{out}=(0.42,0.084)$. Round-trip forward
   slope $=0.084/0.42=0.2$ exact (rational, no solver).
4. **Hold** $v_0=v_1=5$: any $V$ target → disabled affordance; measured $V\equiv0$.
5. **Zero displacement, non-hold** $(v_1=v_0)$: same — disabled, per Limit 2.

## 4.5 Authority eligibility (V6) — which segment representations may use the inverse

Evaluator precedence (defaults.applyEasing, mirrored by the runtime):
**HOLD > complete temporal pair > bezierControlPoints/autoBezier > named easing.**

| Segment state | Inverse edit meaningful? | Policy |
|---|---|---|
| Complete temporal pair (prev.out && next.in) | **yes** — this is the editable subset | gesture writes the pair |
| HOLD start key | no — evaluator returns 0 before handles | affordance DISABLED (never an inert write) |
| bezierControlPoints only (no pair) | no — cp wins until a pair exists | gate DISABLED or upgrade consciously; #57 chose atomic pair write that supersedes cp only when the evaluator will prefer the pair |
| autoBezier (derived cp, no explicit cp) | no — same tier as cp | disabled for the gesture |
| Named non-cubic (bounce/elastic/…) | no — switch branch wins until pair completes | disabled |
| Partial pair (one side only) | target state only after the gesture completes it | atomic pair write IS the completion path (#57) |
| Duplicate/zero-duration frames | no — no curve exists (Limit 2) | refused at scale (`zero-duration`) |
| Zero displacement $v_1=v_0$ | no — $V\equiv0$ for all handles (Limit 2) | refused at scale (`zero-displacement`) |
| Singular x handles ($x_i\in\{0,1\}$ or near) | read: exact by derivative-order descent; write: refused within $\tau$ | see §3 domain 4 |

## 5. Test vectors (RED/GREEN plan for a future PR)

- T1 endpoint-slope table: for 20 sampled handle pairs (property-based over the cone),
  assert `channelVelocityAt` at $t_0^{+},t_1^{-}$ equals $k\,y_1/x_1$, $k\,(1-y_2)/(1-x_2)$
  within the helper's finite-difference error bound (epsilon-aware, documented).
- T2 inverse round-trip: slope → formula → forward measurement → error < 1e-9 (exact subset).
- T3 infeasibility: negative-time targets, cone-projection clamps report, no write.
- T4 zero-displacement/hold: affordance state = disabled; storage untouched.
- T5 parity: any written handle set keeps the A1 fuzz guard (`ografInterpolationDriftGuard`) green.

## 6. PR decomposition if ever approved

- F5a (pure math): **implemented as PR #58 (OPEN — not main behavior)**:
  `src/utils/speedInverse.ts` exposes `endpointSlopesFromHandles`,
  `handlesFromEndpointSlopes`, `segmentVelocityScale`,
  `physicalVelocityToNormalized`, `normalizedSlopeToPhysicalVelocity`;
  V6-corrected classification and explicit refusals. No UI caller until F5b.
- F5b (UI, gated on F5a + product approval): slope handles on the speed panel via
  existing `onChangeKeyframeHandles`; disabled-state rules above; keyboard parity.
- Explicitly out of any first PR: interior reshaping (needs a residual indicator and
  an optimizer — a third engine risk), brush gestures, x-handle editing from speed view.

## 7. Verdict

Arbitrary editable speed graphs are **not** losslessly representable in the current
authored model; a **2-DOF-per-segment endpoint-slope subset is**, with closed-form
inverses, existing storage fields, and no schema change. Everything beyond that
subset is a product decision, not an implementation detail — matching the roadmap's
original gate. This document is that decision paper; implementation approval is a
separate act.
