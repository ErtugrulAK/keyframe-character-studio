/**
 * The generated runtime's copies of KCS's shared rules.
 *
 * The runtime is emitted as a standalone module string, so it cannot `import`
 * the application. Until now it therefore carried hand-written copies of rules
 * that also live in the editor — and those copies drifted: the painted order was
 * inverted because the runtime sorted the authored array while the editor sorted
 * by `zIndex`, and a disabled Track Matte V2 suppressed the legacy matte in the
 * export but not in the editor.
 *
 * This module removes the hand copy. Each snippet is the canonical helper's OWN
 * source, obtained with `Function.prototype.toString`, so there is exactly one
 * definition of the rule and the runtime runs that text. The helpers are
 * deliberately self-contained (no module-scope references), which is what makes
 * their source directly embeddable without a build step, a loader, or `eval`.
 *
 * A helper added here must stay self-contained, and the parity test in
 * `src/tests/ografRuntimeParity.test.ts` proves the embedded text behaves exactly
 * like the imported helper.
 */

import { compareByStackingOrder } from '../utils/layers/stackingOrder';
import { resolveMatteSource } from '../utils/layers/matte';
import { createWorldAffineAlgebra } from '../utils/geometry/containerMath';
import { createGraphicRuntime } from './runtime/graphicRuntime';
import { createShapeAppearance } from '../utils/layers/shapeAppearance';
import { describePaint, describeText } from '../utils/layers/drawDescriptor';

/**
 * A helper's source, as the runtime will receive it.
 *
 * `toString` on a transpiled function yields plain JavaScript, so the emitted
 * module stays valid without a TypeScript step.
 */
const sourceOf = (helper: (...args: never[]) => unknown): string => helper.toString();

/** The stacking comparator — the ONE definition of the editor's paint order. */
export const runtimeCompareByStackingOrder = (): string => sourceOf(compareByStackingOrder as (...args: never[]) => unknown);

/**
 * The matte relationship resolver — the ONE definition of which source a matte
 * uses, including the legacy fallback when a Track Matte V2 record is disabled.
 */
export const runtimeResolveMatteSource = (): string => sourceOf(resolveMatteSource as (...args: never[]) => unknown);

/**
 * Embed the ONE affine authority as a complete lexical closure: an expression
 * that evaluates to the algebra.
 *
 * Serializing helpers separately is unsafe in production: the minifier renames
 * module-scope references inside their source. The self-contained factory keeps
 * those declarations and references together, so its source remains executable
 * after minification without name rewriting or a second copy of the math.
 */
export const runtimeWorldAffineAlgebra = (): string => `(${sourceOf(createWorldAffineAlgebra as (...args: never[]) => unknown)})()`;

/** The editor's appearance rules, as an expression that evaluates to the resolver. */
export const runtimeResolveShapeAppearance = (): string => `(${sourceOf(createShapeAppearance as (...args: never[]) => unknown)})().resolveShapeAppearance`;

/** The shared draw descriptors (`utils/layers/drawDescriptor`): what a layer paints and writes. */
export const runtimeDescribePaint = (): string => sourceOf(describePaint as (...args: never[]) => unknown);
export const runtimeDescribeText = (): string => sourceOf(describeText as (...args: never[]) => unknown);

/**
 * The graphic runtime factory itself. Like the affine algebra it is one
 * self-contained function, so its source runs unchanged in the package.
 */
export const runtimeGraphicFactory = (): string => sourceOf(createGraphicRuntime as (...args: never[]) => unknown);
