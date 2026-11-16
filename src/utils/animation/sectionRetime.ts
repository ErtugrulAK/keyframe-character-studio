/**
 * Retiming one step of a sequence (OGraf Studio's "Set length", in KCS terms):
 * the step markers split a sequence into sections (`utils/animation/stepMarkers`),
 * and one section gets a new length. Its keyframes stretch or squeeze from the
 * section's start, everything after it moves by the difference, and the
 * sequence's own length changes with it.
 *
 * Only keyframe frames move. Easing, control points and temporal handles are
 * normalized to the segment, so every curve keeps its shape and only takes
 * longer or shorter; nothing here evaluates animation.
 */
import type { Track } from '../../types/animator';
import { normalizeStepMarkers } from './stepMarkers';

export interface SequenceSection {
  /** 0-based, in play order. */
  index: number;
  start: number;
  end: number;
}

/** The sections a sequence plays, from its markers. */
export const sequenceSections = (markers: readonly number[] | undefined, durationFrames: number): SequenceSection[] => {
  const ends = [...normalizeStepMarkers(markers, durationFrames), durationFrames];
  let start = 0;
  return ends.map((end, index) => {
    const section = { index, start, end };
    start = end;
    return section;
  });
};

/**
 * The section the playhead is in. A playhead on a marker is at the start of
 * the section that marker opens; the last frame belongs to the last section.
 */
export const sectionAt = (markers: readonly number[] | undefined, durationFrames: number, frame: number): SequenceSection => {
  const sections = sequenceSections(markers, durationFrames);
  return sections.find((section) => frame >= section.start && frame < section.end) ?? sections[sections.length - 1];
};

/** Where `frame` lands once the section `start`→`end` is `length` frames long. */
export const retimeFrame = (frame: number, start: number, end: number, length: number): number => {
  if (frame <= start) return frame;
  if (frame > end) return frame + (length - (end - start));
  return Math.round(start + ((frame - start) * length) / (end - start));
};

type Framed = { frame: number; templateId?: string };

const inSequence = (keyframe: Framed, templateId: string): boolean => (keyframe.templateId || 'Sequence') === templateId;

export type RetimeRefusal = 'invalid' | 'collision' | 'locked';

export interface RetimeInput {
  tracks: Track[];
  templateId: string;
  markers: readonly number[] | undefined;
  durationFrames: number;
  section: SequenceSection;
  length: number;
  /** The most frames the sequence may have afterwards. */
  maxDurationFrames: number;
}

export type RetimeResult =
  | { ok: true; tracks: Track[]; markers: number[]; durationFrames: number; changed: boolean }
  | { ok: false; reason: RetimeRefusal; trackId?: string };

/**
 * The tracks, markers and length of the sequence with `section` retimed to
 * `length` frames. Refused, with nothing changed, when the length is not a
 * whole number of at least one frame or makes the sequence too long, when two
 * keys of one channel would land on the same frame, or when a locked layer's
 * keys would move.
 */
export const retimeSection = (input: RetimeInput): RetimeResult => {
  const { tracks, templateId, section, durationFrames } = input;
  const length = Math.round(input.length);
  const oldLength = section.end - section.start;
  const nextDuration = durationFrames + (length - oldLength);
  if (!Number.isFinite(input.length) || length < 1 || oldLength < 1 || nextDuration > input.maxDurationFrames) {
    return { ok: false, reason: 'invalid' };
  }
  if (length === oldLength) {
    return { ok: true, tracks, markers: normalizeStepMarkers(input.markers, durationFrames), durationFrames, changed: false };
  }
  const map = (frame: number) => retimeFrame(frame, section.start, section.end, length);

  let collision: string | undefined;
  let locked: string | undefined;
  const retimeList = <K extends Framed>(trackId: string, keyframes: K[] | undefined, isLocked: boolean): K[] | undefined => {
    if (!keyframes) return keyframes;
    let moved = false;
    const seen = new Set<number>();
    const next = keyframes.map((keyframe) => {
      if (!inSequence(keyframe, templateId)) return keyframe;
      const frame = map(keyframe.frame);
      if (seen.has(frame)) collision = collision ?? trackId;
      seen.add(frame);
      if (frame === keyframe.frame) return keyframe;
      moved = true;
      return { ...keyframe, frame };
    });
    if (moved && isLocked) locked = locked ?? trackId;
    return moved ? next : keyframes;
  };
  const retimeMap = <K extends Framed>(trackId: string, keyMap: Record<string, K[] | undefined> | undefined, isLocked: boolean) => {
    if (!keyMap) return keyMap;
    let moved = false;
    const next: Record<string, K[] | undefined> = {};
    for (const [channel, keyframes] of Object.entries(keyMap)) {
      next[channel] = retimeList(trackId, keyframes, isLocked);
      if (next[channel] !== keyframes) moved = true;
    }
    return moved ? next : keyMap;
  };

  const nextTracks = tracks.map((track) => {
    const isLocked = Boolean(track.locked);
    const channels = retimeMap(track.id, track.channels as Record<string, Framed[] | undefined> | undefined, isLocked);
    const maskChannels = retimeMap(track.id, track.maskChannels as Record<string, Framed[] | undefined> | undefined, isLocked);
    const maskPathChannels = retimeMap(track.id, track.maskPathChannels as Record<string, Framed[] | undefined> | undefined, isLocked);
    const keyframes = retimeList(track.id, track.keyframes, isLocked);
    if (channels === track.channels && maskChannels === track.maskChannels && maskPathChannels === track.maskPathChannels && keyframes === track.keyframes) return track;
    return {
      ...track,
      channels: channels as Track['channels'],
      maskChannels: maskChannels as Track['maskChannels'],
      maskPathChannels: maskPathChannels as Track['maskPathChannels'],
      keyframes: keyframes as Track['keyframes'],
    };
  });
  if (collision) return { ok: false, reason: 'collision', trackId: collision };
  if (locked) return { ok: false, reason: 'locked', trackId: locked };

  const markers = normalizeStepMarkers(normalizeStepMarkers(input.markers, durationFrames).map(map), nextDuration);
  return { ok: true, tracks: nextTracks, markers, durationFrames: nextDuration, changed: true };
};
