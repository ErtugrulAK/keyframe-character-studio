import type { Transform } from '../types/animator';

/**
 * World affine algebra — the ONE place a world-space 2×2 + translation is built,
 * composed, inverted and emitted.
 *
 * WHY IT EXISTS: a layer's rendered world transform is `R(rotation) · S(scale)`.
 * That is a faithful world model for a single layer, but a hierarchy is NOT the
 * sum of those scalars: `R(θp)·S(sp) · R(θc)·S(sc)` is a general 2×2 whose
 * columns are not orthogonal whenever the parent scales anisotropically and the
 * child is rotated. Folding the parent into the child's own axes (adding the
 * rotations, multiplying the scales) applies the parent's stretch along the
 * CHILD's axis instead of the parent's — a group's horizontal resize stretched a
 * 90°-rotated child vertically, and a 30°-rotated child along its own diagonal.
 *
 * The authored transform stays a TRS (`Transform`, persisted, unchanged). The
 * exact nesting is carried as a DERIVED `WorldAffine` on evaluated world
 * results: 6 numbers, SVG `matrix(a b c d e f)` semantics
 *
 *   (x, y) ↦ (a·x + c·y + e, b·x + d·y + f)
 *
 * so `translate(x y) rotate(r) scale(sx sy)` is `a = sx·cos r`, `b = sx·sin r`,
 * `c = −sy·sin r`, `d = sy·cos r`, `e = x`, `f = y`. Nothing here is persisted
 * and no authored field changes: the affine is derived from the hierarchy on
 * every evaluation, so undo/redo, keyframes and save files keep their exact
 * authored TRS values.
 */

/** SVG `matrix(a b c d e f)` semantics: (x,y) ↦ (a·x + c·y + e, b·x + d·y + f). */
export interface WorldAffine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** The TRS part every affine consumer can also read off a world transform. */
type AffineSource = Pick<Transform, 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY'>;
type AffineCarrier = AffineSource & { affine?: WorldAffine };

/** Self-contained source shared with generated runtimes, including after minification. */
export const createWorldAffineAlgebra = () => {
  /**
   * Relative tolerance for "these two affines are the same map". Exported because
   * the embedded OGraf runtime embeds this module's own source (no second copy of
   * the law), so the constant travels with it.
   */
  const AFFINE_EPSILON = 1e-9;

  /** The affine a TRS renders as: `translate(x y) rotate(rotation) scale(sx sy)`. */
  const affineOfTransform = ({ x, y, rotation, scaleX, scaleY }: AffineSource): WorldAffine => {
    const radians = (rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      a: scaleX * cos,
      b: scaleX * sin,
      c: -scaleY * sin,
      d: scaleY * cos,
      e: x,
      f: y,
    };
  };

  /** `outer ∘ inner`: the map that applies `inner` first, then `outer`. */
  const composeAffine = (outer: WorldAffine, inner: WorldAffine): WorldAffine => ({
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  });

  /** The inverse map, or null for a collapsed (non-invertible) affine. */
  const invertAffine = (matrix: WorldAffine): WorldAffine | null => {
    const det = matrix.a * matrix.d - matrix.b * matrix.c;
    if (!Number.isFinite(det) || Math.abs(det) < Number.EPSILON) return null;
    return {
      a: matrix.d / det,
      b: -matrix.b / det,
      c: -matrix.c / det,
      d: matrix.a / det,
      e: (matrix.c * matrix.f - matrix.d * matrix.e) / det,
      f: (matrix.b * matrix.e - matrix.a * matrix.f) / det,
    };
  };

  const applyAffine = (matrix: WorldAffine, point: { x: number; y: number }): { x: number; y: number } => ({
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  });

  /** The linear part only — a direction delta, never a position. */
  const applyAffineDelta = (matrix: WorldAffine, delta: { x: number; y: number }): { x: number; y: number } => ({
    x: matrix.a * delta.x + matrix.c * delta.y,
    y: matrix.b * delta.x + matrix.d * delta.y,
  });

  /**
   * True when the linear part is a pure rotation + axis scale, i.e. its columns
   * stay orthogonal: exactly the case an authored TRS can render on its own.
   */
  const affineHasShear = (matrix: WorldAffine, tolerance = AFFINE_EPSILON): boolean => {
    const firstLength = Math.hypot(matrix.a, matrix.b);
    const secondLength = Math.hypot(matrix.c, matrix.d);
    if (firstLength === 0 || secondLength === 0) return false;
    const normalizedDot = (matrix.a * matrix.c + matrix.b * matrix.d) / (firstLength * secondLength);
    return Math.abs(normalizedDot) > tolerance;
  };

  /**
   * The canonical TRS reading of an affine: rotation from the transformed X axis
   * (so `scaleX` carries the magnitude and only `scaleY` can be negative). For a
   * shear-free affine this is an EXACT decomposition — rebuilding the affine from
   * it reproduces the same map.
   */
  const affineToTransform = (matrix: WorldAffine): AffineSource => {
    const rotation = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
    const scaleX = Math.hypot(matrix.a, matrix.b);
    const det = matrix.a * matrix.d - matrix.b * matrix.c;
    return {
      x: matrix.e,
      y: matrix.f,
      rotation,
      scaleX,
      scaleY: scaleX > 0 ? det / scaleX : 0,
    };
  };

  /** Same map? Element-wise, relative to magnitude so large scenes stay exact. */
  const affineEquals = (left: WorldAffine, right: WorldAffine): boolean =>
    (['a', 'b', 'c', 'd', 'e', 'f'] as const).every((key) => {
      const scale = Math.max(1, Math.abs(left[key]), Math.abs(right[key]));
      return Math.abs(left[key] - right[key]) <= AFFINE_EPSILON * scale;
    });

  /**
   * The world affine of a layer from its TRS reading: the affine itself when the
   * evaluated result carries one, otherwise the TRS' own map. Every geometry
   * consumer goes through this, so a caller holding only an authoring `Transform`
   * keeps working.
   */
  const worldAffineOf = (transform: AffineCarrier | undefined): WorldAffine =>
    transform?.affine ?? affineOfTransform(transform ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });

  /**
   * The world value consumers read: the authored TRS reading plus the derived
   * affine — and the affine field is attached ONLY when a TRS cannot re-create
   * that map. The common (shear-free) nesting therefore keeps the exact historical
   * numbers and carries no extra field, while a sheared nesting carries the map
   * that renders and measures.
   */
  const withWorldAffine = <T extends AffineSource>(
    trs: T,
    affine: WorldAffine,
  ): T & { affine?: WorldAffine } => (
    // A tolerant match on purpose: the nesting of a uniform parent (or an
    // axis-aligned child) is TRS-exact but its floating-point product differs from
    // the summed/multiplied reading in the last bits, and such a layer must stay
    // on the historical path — no affine field, no extra allocation, no different
    // gesture frame.
    affineEquals(affineOfTransform(trs), affine) ? { ...trs } : { ...trs, affine }
  );

  /**
   * The exact TRS reading of an affine for emitters that print their own numbers:
   * the authored `trs` when its map IS the affine (so every existing layer keeps
   * its historical spelling), the canonical rotate/scale reading when the affine
   * is shear-free but its axes were swapped (a 90°-rotated child of an
   * anisotropically scaled container — still an exact TRS), and null when the map
   * genuinely shears and only `matrix(...)` can express it.
   */
  const affineTrsReading = (affine: WorldAffine, trs: AffineSource): AffineSource | null => {
    if (affineEquals(affineOfTransform(trs), affine)) return trs;
    return affineHasShear(affine) ? null : affineToTransform(affine);
  };

  /**
   * The SVG `transform` attribute of a world affine, with the output-origin
   * translation folded in.
   *
   * Byte-for-byte the historical `translate(...) rotate(...) scale(...)` form
   * whenever a TRS reproduces the affine exactly — so every existing layer,
   * project and export emits exactly what it always did — and `matrix(...)`, the
   * exact affine by construction, only for the genuinely sheared nesting.
   */
  const affineSvgTransform = (
    affine: WorldAffine,
    trs: AffineSource,
    origin: { x: number; y: number },
  ): string => {
    const reading = affineTrsReading(affine, trs);
    if (reading) {
      return `translate(${origin.x + reading.x}, ${origin.y + reading.y}) rotate(${reading.rotation}) scale(${reading.scaleX}, ${reading.scaleY})`;
    }
    return `translate(${origin.x}, ${origin.y}) matrix(${affine.a} ${affine.b} ${affine.c} ${affine.d} ${affine.e} ${affine.f})`;
  };

  /**
   * Compose a parent's transform with a direct child's own (local) transform.
   *
   * This IS the composition `evaluateTransform` applies while walking the
   * parent-child chain: the parent's scale scales the child's offset, the
   * parent's rotation rotates it, rotation adds and scale multiplies, and opacity
   * (like masks) is never inherited — the child keeps its own. It lives here, next
   * to its exact inverse, so no second copy of the law can drift from the
   * evaluator.
   *
   * Positions always follow the exact parent map. Rotation/scale remain the
   * authored TRS reading; geometry consumers use the derived affine for axes.
   */
  const composeWorldTransform = (parent: Transform & { affine?: WorldAffine }, child: Transform): Transform => {
    let x: number;
    let y: number;
    if (parent.affine) {
      x = parent.affine.a * child.x + parent.affine.c * child.y + parent.affine.e;
      y = parent.affine.b * child.x + parent.affine.d * child.y + parent.affine.f;
    } else {
      const radians = (parent.rotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const scaledChildX = child.x * parent.scaleX;
      const scaledChildY = child.y * parent.scaleY;
      x = parent.x + scaledChildX * cos - scaledChildY * sin;
      y = parent.y + scaledChildX * sin + scaledChildY * cos;
    }
    return {
      ...child,
      x,
      y,
      rotation: parent.rotation + child.rotation,
      scaleX: parent.scaleX * child.scaleX,
      scaleY: parent.scaleY * child.scaleY,
      opacity: child.opacity,
    };
  };

  /**
   * Recover authored container-local TRS. Position uses the exact affine inverse;
   * scalar rotation/scale undo the authored reading, never a shear decomposition.
   */
  const worldToContainerLocal = (
    world: Transform & { affine?: WorldAffine },
    parent: Transform & { affine?: WorldAffine },
  ): Transform => {
    const inverse = parent.affine ? invertAffine(parent.affine) : null;
    let x: number;
    let y: number;
    if (inverse) {
      x = inverse.a * world.x + inverse.c * world.y + inverse.e;
      y = inverse.b * world.x + inverse.d * world.y + inverse.f;
    } else {
      const radians = (parent.rotation * Math.PI) / 180;
      const dx = world.x - parent.x;
      const dy = world.y - parent.y;
      x = (dx * Math.cos(radians) + dy * Math.sin(radians)) / (parent.scaleX || 1);
      y = (-dx * Math.sin(radians) + dy * Math.cos(radians)) / (parent.scaleY || 1);
    }
    const local = {
      ...world,
      x,
      y,
      rotation: world.rotation - parent.rotation,
      scaleX: world.scaleX / (parent.scaleX || 1),
      scaleY: world.scaleY / (parent.scaleY || 1),
    };
    // Evaluated world metadata must never become authored local state.
    if (local.affine) delete local.affine;
    return local;
  };

  return {
    AFFINE_EPSILON,
    affineOfTransform,
    composeAffine,
    invertAffine,
    applyAffine,
    applyAffineDelta,
    affineHasShear,
    affineToTransform,
    affineEquals,
    worldAffineOf,
    withWorldAffine,
    affineTrsReading,
    affineSvgTransform,
    composeWorldTransform,
    worldToContainerLocal,
  };
};

export const {
  AFFINE_EPSILON,
  affineOfTransform,
  composeAffine,
  invertAffine,
  applyAffine,
  applyAffineDelta,
  affineHasShear,
  affineToTransform,
  affineEquals,
  worldAffineOf,
  withWorldAffine,
  affineTrsReading,
  affineSvgTransform,
  composeWorldTransform,
  worldToContainerLocal,
} = createWorldAffineAlgebra();
