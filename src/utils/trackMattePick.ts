import type { CharacterPart, TrackMatteV2 } from '../types/animator';
import { validateCritical, type LayerRef } from './validateScene';

/**
 * C4 — Track Matte pick-whip: may the layer under the pointer become the
 * target's matte source? The answer comes from the EXISTING scene validator
 * (`validateCritical`: self reference, cycles, missing layers), applied to the
 * scene as it would be after the pick — no second relationship rule set. The
 * relationship itself stays where it always lives: `target.trackMatte`.
 */
export type TrackMattePickVerdict =
  | { ok: true; sourceName: string }
  | { ok: false; reason: string };

/** The relationship the pick writes — the same shape the Inspector's source list writes. */
export const pickedTrackMatte = (current: TrackMatteV2 | undefined, sourceLayerId: string): TrackMatteV2 => ({
  sourceLayerId,
  mode: current?.mode ?? 'alpha',
  enabled: current?.enabled !== false,
  inverted: current?.inverted === true,
  sourceVisible: current?.sourceVisible !== false,
});

export const trackMattePickVerdict = (
  parts: readonly CharacterPart[],
  targetId: string,
  candidateId: string | null | undefined,
): TrackMattePickVerdict => {
  if (!candidateId) return { ok: false, reason: 'Drop on a layer to use it as the matte.' };
  const target = parts.find((part) => part.id === targetId);
  const candidate = parts.find((part) => part.id === candidateId);
  if (!target) return { ok: false, reason: 'The target layer no longer exists.' };
  if (!candidate) return { ok: false, reason: 'That layer no longer exists.' };
  if (candidateId === targetId) return { ok: false, reason: 'A layer cannot be its own matte.' };
  if (target.trackMatte?.sourceLayerId === candidateId) return { ok: false, reason: `“${candidate.name || candidate.id}” is already the matte of this layer.` };
  const next = parts.map((part) => (part.id === targetId ? { ...part, trackMatte: pickedTrackMatte(part.trackMatte, candidateId) } : part));
  // Only what THIS pick would introduce counts: an unrelated problem elsewhere
  // in the scene does not block every pick.
  const key = (error: { type: string; layerId?: string }) => error.type + ':' + (error.layerId ?? '');
  const before = new Set(validateCritical({ layers: parts as unknown as LayerRef[] }).map(key));
  const blocking = validateCritical({ layers: next as unknown as LayerRef[] })
    .find((error) => !before.has(key(error)) && /track matte/i.test(error.message));
  if (blocking) {
    return /cycle/i.test(blocking.message)
      ? { ok: false, reason: `“${candidate.name || candidate.id}” already uses this layer (directly or through other layers) as its matte — that would be a loop.` }
      : { ok: false, reason: blocking.message };
  }
  return { ok: true, sourceName: candidate.name || candidate.id };
};
