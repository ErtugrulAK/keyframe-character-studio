import type { CharacterPart, HomeTransform, Track, TrackChannel } from '../../types/animator';

/** The transform channels Reset Transform clears: the ones the TRANSFORM card shows. */
const TRANSFORM_CHANNELS: TrackChannel[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];

/** A stored home pose is usable only when every number is finite. */
export const isHomeTransform = (value: unknown): value is HomeTransform => (
  typeof value === 'object' && value !== null
  && (['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const).every((key) => Number.isFinite((value as Record<string, unknown>)[key]))
);

/**
 * Reset Transform: the selected layers go back to the pose they were made with
 * (position, rotation, scale, opacity), and their transform animation in the
 * active sequence is cleared, so the reset pose is what plays. A layer from an
 * older project, made before the pose was recorded, keeps its position and
 * loses its rotation, scale and opacity changes. Pure; one call is one undo step
 * for the caller. Returns null when nothing would change.
 */
export const resetTransforms = (
  parts: CharacterPart[],
  tracks: Track[],
  ids: string[],
  activeTemplateId: string,
): { parts: CharacterPart[]; tracks: Track[] } | null => {
  const chosen = new Set(ids);
  let changed = false;
  const nextParts = parts.map((part) => {
    if (!chosen.has(part.id)) return part;
    const home = isHomeTransform(part.homeTransform)
      ? part.homeTransform
      : { x: part.baseTransform.x, y: part.baseTransform.y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const base = part.baseTransform;
    if ((['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const).every((key) => base[key] === home[key])) return part;
    changed = true;
    return { ...part, baseTransform: { ...base, ...home } };
  });
  const inSequence = (key: { templateId?: string }) => (key.templateId || 'Sequence') === activeTemplateId;
  const nextTracks = tracks.map((track) => {
    if (!chosen.has(track.partId)) return track;
    const hasKeys = TRANSFORM_CHANNELS.some((channel) => track.channels?.[channel]?.some(inSequence))
      || (track.keyframes ?? []).some(inSequence);
    if (!hasKeys) return track;
    changed = true;
    const channels = { ...track.channels };
    for (const channel of TRANSFORM_CHANNELS) {
      if (channels[channel]) channels[channel] = channels[channel].filter((key) => !inSequence(key));
    }
    return { ...track, channels, keyframes: (track.keyframes ?? []).filter((key) => !inSequence(key)) };
  });
  return changed ? { parts: nextParts, tracks: nextTracks } : null;
};
