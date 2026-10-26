import type { CharacterPart, MotionTemplate, Track } from '../types/animator';

/**
 * C10 — changing the frame rate keeps TIME, as in After Effects: a 2-second
 * animation is still 2 seconds at the new rate. Every frame number the
 * document stores is rescaled by `toFps / fromFps` and rounded to a whole
 * frame:
 * - every keyframe (canonical channels, mask scalar and path channels, legacy
 *   composite keys) — rounding is monotonic, so a key inside its sequence
 *   stays inside the rescaled sequence;
 * - every sequence duration, and the timeline length / playhead;
 * - the IN/OUT preset durations and the text stagger start frame of each part.
 * Values, easing, bezier handles (normalised) and IDs are untouched. Two keys
 * of one property that land on the same frame (a lower rate has fewer frames)
 * are merged: the later one is kept, and the count is reported.
 *
 * Time-based fields (text unit duration in ms) and the reusable preset library
 * (not scene data) are not frame numbers here and stay as they are.
 */
export interface FpsRetimeDocument {
  tracks: Track[];
  characterParts: CharacterPart[];
  motionTemplates: MotionTemplate[];
  totalFrames: number;
  currentFrame: number;
}

export interface FpsRetimeResult extends FpsRetimeDocument {
  /** Keys dropped because a later key of the same property landed on the same frame. */
  mergedKeys: number;
}

const DEFAULT_SEQUENCE = 'Sequence';

export const retimeDocumentForFps = (doc: FpsRetimeDocument, fromFps: number, toFps: number): FpsRetimeResult => {
  if (!(fromFps > 0) || !(toFps > 0) || fromFps === toFps) return { ...doc, mergedKeys: 0 };
  const factor = toFps / fromFps;
  const scale = (frame: number) => Math.max(0, Math.round(frame * factor));
  const scaleDuration = (frames: number) => Math.max(1, Math.round(frames * factor));

  const motionTemplates = doc.motionTemplates.map((template) => ({ ...template, durationFrames: scaleDuration(template.durationFrames) }));
  const totalFrames = scaleDuration(doc.totalFrames);

  let mergedKeys = 0;
  const retimeKeys = <K extends { frame: number; templateId?: string }>(keys: K[]): K[] => {
    // Sorted by the ORIGINAL frame, so on a collision the later key wins.
    const ordered = keys
      .map((key, index) => ({ key, index }))
      .sort((a, b) => a.key.frame - b.key.frame || a.index - b.index);
    const bySlot = new Map<string, K>();
    for (const { key } of ordered) {
      const frame = scale(key.frame);
      const slot = `${key.templateId || DEFAULT_SEQUENCE}\u0000${frame}`;
      if (bySlot.has(slot)) mergedKeys += 1;
      bySlot.set(slot, { ...key, frame });
    }
    return [...bySlot.values()];
  };
  const retimeStore = <K extends { frame: number; templateId?: string }>(store: Record<string, K[]> | undefined) => {
    if (!store) return store;
    return Object.fromEntries(Object.entries(store).map(([channel, keys]) => [channel, Array.isArray(keys) ? retimeKeys(keys) : keys]));
  };

  const tracks = doc.tracks.map((track) => ({
    ...track,
    channels: retimeStore(track.channels) as Track['channels'],
    ...(track.maskChannels ? { maskChannels: retimeStore(track.maskChannels) as Track['maskChannels'] } : {}),
    ...(track.maskPathChannels ? { maskPathChannels: retimeStore(track.maskPathChannels) as Track['maskPathChannels'] } : {}),
    ...(track.keyframes ? { keyframes: retimeKeys(track.keyframes) } : {}),
  }));

  const characterParts = doc.characterParts.map((part) => {
    const next: CharacterPart = { ...part };
    if (typeof part.inAnimDuration === 'number') next.inAnimDuration = scale(part.inAnimDuration);
    if (typeof part.outAnimDuration === 'number') next.outAnimDuration = scale(part.outAnimDuration);
    if (typeof part.textAnimStartFrame === 'number') next.textAnimStartFrame = scale(part.textAnimStartFrame);
    return next;
  });

  return {
    tracks,
    characterParts,
    motionTemplates,
    totalFrames,
    currentFrame: Math.min(scale(doc.currentFrame), totalFrames),
    mergedKeys,
  };
};
