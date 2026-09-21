import type { LottieImportDiagnostic } from './diagnostics';

/**
 * Temporal conversion for the Lottie importer (Milestone F, item 10).
 *
 * Lottie describes a *segment* between two keyframes with `o` (outgoing) and `i`
 * (incoming) Bezier control points; KCS describes a *keyframe* with `bezierIn`
 * and `bezierOut`. One Lottie pair therefore splits across the two keyframes it
 * connects — see `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` §6.
 *
 * The importer preserves the document frame rate as the scene frame rate, so
 * Lottie frame units and scene frames are the same unit and the time mapping is
 * the documented offset plus rounding. Nothing here guesses: an unsupported
 * segment (roving, expression-driven) is reported and falls back to `linear`.
 *
 * The timing decision lives in one place (`mapLottieSegmentTiming`) because both
 * the numeric channels and the mask-geometry channel must split segments the
 * same way; a second copy of this rule would be a second authority.
 */

/** A Lottie keyframe as read from the document (numbers already validated by the caller). */
export interface LottieKeyframe {
  time: number;
  /**
   * One entry per Lottie dimension (`p: [x, y]`, `s: [x, y]`, `o: [value]`).
   * A channel maps one dimension, so a vector property never aliases its
   * first component into every channel.
   */
  values: number[];
  hold?: boolean;
  /** Outgoing control point of the segment that starts here. */
  out?: { x: number; y: number };
  /** Incoming control point of the segment that ends at the next keyframe. */
  in?: { x: number; y: number };
  roving?: boolean;
  expression?: string;
}

export interface TemporalMappingContext {
  /** Which component of the Lottie value this channel maps (`0` for scalars). */
  dimension: number;
  /** Document in-point in Lottie frame units. */
  documentInPoint: number;
  /** Layer start time in Lottie frame units. */
  layerStartTime?: number;
  /** Maximum keyframes accepted per channel (the design's first-cut limit). */
  keyframeLimit: number;
  /** Diagnostic path prefix, for example `layers[3].ks.p`. */
  path: string;
  /** Channel name used in reports. */
  channel: string;
}

/** The value-independent part of a mapped keyframe. */
export interface SegmentTiming {
  frame: number;
  easing: 'linear' | 'hold' | 'bezier';
  bezierIn?: { x: number; y: number };
  bezierOut?: { x: number; y: number };
}

export interface MappedKeyframe extends SegmentTiming {
  id: string;
  value: number;
}

export interface TemporalMappingResult {
  keyframes: MappedKeyframe[];
  diagnostics: LottieImportDiagnostic[];
}

export interface SegmentTimingResult {
  /** The keyframes inside the limit, in document order. */
  accepted: LottieKeyframe[];
  /** One timing per accepted keyframe, in the same order. */
  timing: SegmentTiming[];
  diagnostics: LottieImportDiagnostic[];
}

const readDimension = (keyframe: LottieKeyframe, dimension: number): number =>
  keyframe.values[dimension] ?? keyframe.values[keyframe.values.length - 1] ?? 0;

const toSceneFrame = (time: number, context: TemporalMappingContext): number =>
  Math.max(0, Math.round(time - context.documentInPoint - (context.layerStartTime ?? 0)));

/**
 * Maps the timing of one channel's keyframes — frames, easing and the split
 * handles — and reports the segments that cannot be represented.
 *
 * The `in` handle of a segment becomes `bezierIn` on the keyframe that ends the
 * segment, and the `out` handle becomes `bezierOut` on the keyframe that starts
 * it, so a converted channel keeps both sides of every curve.
 */
export const mapLottieSegmentTiming = (
  keyframes: LottieKeyframe[],
  context: TemporalMappingContext,
): SegmentTimingResult => {
  const diagnostics: LottieImportDiagnostic[] = [];
  const accepted = keyframes.slice(0, context.keyframeLimit);
  if (keyframes.length > accepted.length) {
    diagnostics.push({
      code: 'LOTTIE_KEYFRAME_LIMIT',
      severity: 'warning',
      feature: 'lottie-import',
      path: context.path,
      message: `Channel "${context.channel}" has ${keyframes.length} keyframes; only the first ${context.keyframeLimit} were imported.`,
      action: 'Split the animation in the source document and import the parts separately.',
    });
  }

  const timing: SegmentTiming[] = accepted.map((keyframe, index) => {
    // A roving or expression-driven segment cannot be represented faithfully,
    // so it is reported below and deliberately kept linear: keeping its handles
    // would claim a curve the source does not actually describe.
    const unsupportedSegment = keyframe.roving === true || keyframe.expression !== undefined;
    const hold = keyframe.hold === true;
    const startsSegment = !hold && !unsupportedSegment && keyframe.out !== undefined && accepted[index + 1] !== undefined;
    const mapped: SegmentTiming = {
      frame: toSceneFrame(keyframe.time, context),
      easing: hold ? 'hold' : 'linear',
    };
    if (startsSegment && keyframe.out) {
      mapped.easing = 'bezier';
      mapped.bezierOut = { x: keyframe.out.x, y: keyframe.out.y };
    }
    if (keyframe.roving) {
      diagnostics.push({
        code: 'LOTTIE_ROVING_KEYFRAME',
        severity: 'warning',
        feature: 'lottie-import',
        path: `${context.path}[${index}]`,
        message: `Keyframe ${index} of "${context.channel}" uses roving timing, which KCS does not model.`,
        action: 'Set explicit keyframe times in the source document and export again.',
      });
    }
    if (keyframe.expression) {
      diagnostics.push({
        code: 'LOTTIE_UNSUPPORTED_EXPRESSION',
        severity: 'warning',
        feature: 'lottie-import',
        path: `${context.path}[${index}]`,
        message: `Keyframe ${index} of "${context.channel}" is driven by an expression, which is preserved but not evaluated.`,
        action: 'Bake the expression in the source document and export again.',
      });
    }
    return mapped;
  });

  // Lottie stores the incoming control point of a segment on the keyframe the
  // segment *starts* from, so it becomes bezierIn on the keyframe that ends it.
  accepted.forEach((keyframe, index) => {
    if (keyframe.hold === true || keyframe.roving === true || keyframe.expression !== undefined) return;
    const incoming = keyframe.in;
    const target = timing[index + 1];
    if (!incoming || !target) return;
    target.easing = 'bezier';
    target.bezierIn = { x: incoming.x, y: incoming.y };
  });

  return { accepted, timing, diagnostics };
};

/**
 * Maps one numeric channel's Lottie keyframes into canonical KCS keyframes.
 */
export const mapLottieKeyframes = (keyframes: LottieKeyframe[], context: TemporalMappingContext): TemporalMappingResult => {
  const { accepted, timing, diagnostics } = mapLottieSegmentTiming(keyframes, context);
  const mapped: MappedKeyframe[] = accepted.map((keyframe, index) => ({
    id: `kf-${context.channel}-${index}`,
    ...timing[index],
    value: readDimension(keyframe, context.dimension),
  }));
  return { keyframes: mapped, diagnostics };
};
