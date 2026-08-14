import type { CustomMotionPresetKeyframe, CharacterPart } from '../types/animator';
import { computeProceduralDelta } from './proceduralAnimation';

/**
 * M25 25C — builtin animation preset → CustomMotionPreset keyframes.
 *
 * Samples the EXISTING procedural runtime (computeProceduralDelta /
 * applyPreset → applyBuiltin) at deterministic progress points and stores
 * the sampled deltas as CustomMotionPresetKeyframes. The resulting custom
 * preset is fully independent of the original builtin id (builtin code can
 * change later without mutating the saved user preset).
 *
 * The custom preset sampler interpolates linearly between keyframe points,
 * so sampling at the interpolation-visible points (0/0.25/0.5/0.75/1) makes
 * the saved preset reproduce the builtin curve closely — exactly at every
 * sampled point (0, 0.5 and 1 are exact by construction).
 */

const SAMPLE_POINTS = [0, 0.25, 0.5, 0.75, 1];

export function builtinPresetToCustomKeyframes(
  builtinId: string,
  durationFrames: number,
  mode: 'in' | 'out',
): CustomMotionPresetKeyframe[] {
  // Minimal part that drives the builtin path in the procedural runtime.
  const part = {
    id: '__sample__',
    name: 'Sample',
    type: 'custom_box',
    zIndex: 1,
    pivot: { x: 0, y: 0 },
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000',
    strokeColor: '#101218',
    strokeWidth: 2,
    enableMotionAnim: true,
    ...(mode === 'in'
      ? { inAnimPreset: builtinId, inAnimDuration: durationFrames }
      : { outAnimPreset: builtinId, outAnimDuration: durationFrames }),
  } as CharacterPart;

  const runtime = {
    appMode: 'broadcast' as const,
    broadcast: {
      __sample__: { state: (mode === 'in' ? 'animating_in' : 'animating_out') as string, progress: 0 },
    },
    liveStunts: {},
  };

  return SAMPLE_POINTS.map((progress) => {
    runtime.broadcast.__sample__.progress = progress;
    const d = computeProceduralDelta(part, [], 90, 0, runtime, []);
    return {
      progress,
      deltaX: d.x,
      deltaY: d.y,
      rotation: d.rotation,
      scaleX: d.scaleX,
      scaleY: d.scaleY,
      opacity: d.opacityMul,
    };
  });
}
