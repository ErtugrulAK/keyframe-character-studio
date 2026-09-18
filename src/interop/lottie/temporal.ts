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
 */

/** A Lottie keyframe as read from the document (numbers already validated by the caller). */
export interface LottieKeyframe {
  time: number;
  value: number;
  hold?: boolean;
  /** Outgoing control point of the segment that starts here. */
  out?: { x: number; y: number };
  /** Incoming control point of the segment that ends at the next keyframe. */
  in?: { x: number; y: number };
  roving?: boolean;
  expression?: string;
}

export interface TemporalMappingContext {
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

export interface MappedKeyframe {
  id: string;
  frame: number;
  value: number;
  easing: 'linear' | 'hold' | 'bezier';
  bezierIn?: { x: number; y: number };
  bezierOut?: { x: number; y: number };
}

export interface TemporalMappingResult {
  keyframes: MappedKeyframe[];
  diagnostics: LottieImportDiagnostic[];
}

const toSceneFrame = (time: number, context: TemporalMappingContext): number =>
  Math.max(0, Math.round(time - context.documentInPoint - (context.layerStartTime ?? 0)));

/**
 * Maps one channel's Lottie keyframes into canonical KCS keyframes.
 *
 * The `in` handle of a segment becomes `bezierIn` on the keyframe that ends the
 * segment, and the `out` handle becomes `bezierOut` on the keyframe that starts
 * it, so a converted channel keeps both sides of every curve.
 */
export const mapLottieKeyframes = (keyframes: LottieKeyframe[], context: TemporalMappingContext): TemporalMappingResult => {
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

  const mapped: MappedKeyframe[] = accepted.map((keyframe, index) => {
    const hold = keyframe.hold === true;
    const startsSegment = !hold && keyframe.out !== undefined && accepted[index + 1] !== undefined;
    const mappedKeyframe: MappedKeyframe = {
      id: `kf-${context.channel}-${index}`,
      frame: toSceneFrame(keyframe.time, context),
      value: keyframe.value,
      easing: hold ? 'hold' : 'linear',
    };
    if (startsSegment && keyframe.out) {
      mappedKeyframe.easing = 'bezier';
      mappedKeyframe.bezierOut = { x: keyframe.out.x, y: keyframe.out.y };
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
    return mappedKeyframe;
  });

  // Lottie stores the incoming control point of a segment on the keyframe the
  // segment *starts* from, so it becomes bezierIn on the keyframe that ends it.
  accepted.forEach((keyframe, index) => {
    if (keyframe.hold === true) return;
    const incoming = keyframe.in;
    const target = mapped[index + 1];
    if (!incoming || !target) return;
    target.easing = 'bezier';
    target.bezierIn = { x: incoming.x, y: incoming.y };
  });

  return { keyframes: mapped, diagnostics };
};
