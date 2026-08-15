import type { Track, TrackChannel, Keyframe, PropertyKeyframe } from '../types/animator';
import { TRACK_CHANNELS } from '../types/animator';
import { generateId } from './idGenerator';

/**
 * M28 28A — TIMELINE KEYFRAME COPY / PASTE (pure data layer).
 *
 * COPY:  `copyKeyframeGroupData(track, frame)` captures the WHOLE logical
 *        frame-group (every channel PropertyKeyframe at the frame PLUS any
 *        legacy composite Keyframe) as a track-independent payload — no ids,
 *        no track identity, deep-cloned (never shares references with source).
 * PASTE: `pasteKeyframeGroupData(targetTrack, targetFrame, payload, totalFrames)`
 *        clones the payload onto an EXISTING target track at an explicit
 *        target frame with FRESH ids (M26/M27 conventions). Collision / out
 *        of range / empty payload are safe no-ops (M27 semantics).
 *
 * Supports same-track AND cross-track paste through the same pure helper.
 * M8 SAFE: copies existing Track.channels/keyframes — no new TrackChannel,
 * no evaluateFrame/playback/timing/serialization change.
 */

/** Track-independent animation payload captured at COPY time (no ids, no
 *  track identity — pure animation data; ids are generated at PASTE time). */
export interface KeyframeCopyPayload {
  /** Channel keyframes at the source frame (frame numbers are relative — the
   *  paste target frame is assigned later; templateId/easing/bezier kept). */
  channels: Partial<Record<TrackChannel, Array<Omit<PropertyKeyframe, 'id'>>>>;
  /** Legacy composite keyframes at the source frame (transform deep-cloned). */
  legacy: Array<Omit<Keyframe, 'id'>>;
}

export interface PasteKeyframeResult {
  /** The resulting track (identical to input on safe no-op). */
  track: Track;
  /** true when keyframes were actually pasted, false for safe no-op. */
  pasted: boolean;
}

function cloneBezier<T extends { bezierControlPoints?: [number, number, number, number] }>(pk: T): T {
  return pk.bezierControlPoints
    ? { ...pk, bezierControlPoints: [...pk.bezierControlPoints] as [number, number, number, number] }
    : pk;
}

export function copyKeyframeGroupData(track: Track, frame: number): KeyframeCopyPayload {
  const channels: KeyframeCopyPayload['channels'] = {};
  for (const ch of TRACK_CHANNELS) {
    const kfs = (track.channels ?? {})[ch] ?? [];
    const atFrame = kfs.filter((k) => k.frame === frame);
    if (atFrame.length > 0) {
      // Deep-clone each keyframe and DROP its id (fresh ids at paste time).
      channels[ch] = atFrame.map((k) => {
        const { id: _dropId, ...rest } = k;
        return cloneBezier(rest);
      });
    }
  }
  const legacy = ((track.keyframes ?? []).filter((k) => k.frame === frame) ?? []).map((k) => {
    const { id: _dropId, ...rest } = k;
    return { ...cloneBezier(rest), transform: { ...rest.transform } };
  });
  return { channels, legacy };
}

export function pasteKeyframeGroupData(
  targetTrack: Track,
  targetFrame: number,
  payload: KeyframeCopyPayload,
  totalFrames?: number,
): PasteKeyframeResult {
  // Frame validation: [0, totalFrames]; no wrapping, no timeline extension.
  if (!Number.isFinite(targetFrame) || targetFrame < 0) {
    return { track: targetTrack, pasted: false };
  }
  if (totalFrames !== undefined && targetFrame > totalFrames) {
    return { track: targetTrack, pasted: false };
  }

  const channelKeys = TRACK_CHANNELS.filter((ch) => (payload.channels[ch] ?? []).length > 0);
  const hasLegacy = payload.legacy.length > 0;
  if (channelKeys.length === 0 && !hasLegacy) {
    return { track: targetTrack, pasted: false }; // empty payload
  }

  // Collision (M27 semantics): ANY relevant keyframe at the target frame on
  // the target track (any channel, not just the payload channels, plus any
  // legacy keyframe) → safe no-op (no partial overwrite / merge / destroy).
  const targetChannels = targetTrack.channels ?? {};
  const channelCollision = TRACK_CHANNELS.some((ch) =>
    (targetChannels[ch] ?? []).some((k) => k.frame === targetFrame),
  );
  const legacyCollision = (targetTrack.keyframes ?? []).some((k) => k.frame === targetFrame);
  if (channelCollision || legacyCollision) {
    return { track: targetTrack, pasted: false };
  }

  const newChannels = { ...targetChannels };
  for (const ch of channelKeys) {
    const clones = (payload.channels[ch] ?? []).map((pk) => ({
      ...pk,
      id: generateId(`pkf_${ch}`),
      frame: targetFrame,
      // Re-clone nested bezier so the pasted keyframe never shares a
      // reference with the clipboard payload (payload stays immutable).
      ...(pk.bezierControlPoints
        ? { bezierControlPoints: [...pk.bezierControlPoints] as [number, number, number, number] }
        : {}),
    }));
    // Keep target channel keyframes untouched and APPEND the clones.
    newChannels[ch] = [...(targetChannels[ch] ?? []), ...clones];
  }

  const newLegacy = hasLegacy
    ? (targetTrack.keyframes ?? []).concat(
        payload.legacy.map((k) => ({
          ...k,
          id: generateId('kf'),
          frame: targetFrame,
          transform: { ...k.transform },
          ...(k.bezierControlPoints
            ? { bezierControlPoints: [...k.bezierControlPoints] as [number, number, number, number] }
            : {}),
        })),
      )
    : targetTrack.keyframes ?? [];

  return {
    track: { ...targetTrack, channels: newChannels, keyframes: newLegacy },
    pasted: true,
  };
}
