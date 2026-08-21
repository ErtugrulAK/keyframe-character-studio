import { describe, it, expect } from 'vitest';
import { cloneAnimationOntoTarget } from '../utils/animationTransfer';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';

/**
 * M26 26A — COPY ANIMATION ONTO EXISTING PART (pure data layer).
 * Source clipboard (part + track) → target existing part: ONLY animation
 * data transfers; target identity/visuals/matte/parent stay untouched.
 */

function makePart(id: string, overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id, name: `Part ${id}`, type: 'custom_box', zIndex: 1, pivot: { x: 0, y: 0 },
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2,
    ...overrides,
  } as CharacterPart;
}

function makeSourceTrack(): Track {
  const channels = makeEmptyChannels();
  channels.x = [
    { id: 'src_x_1', frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' },
    { id: 'src_x_2', frame: 20, value: 100, easing: 'easeInOut', bezierControlPoints: [0.2, 0, 0.8, 1], templateId: 'Sequence' },
  ];
  channels.y = [{ id: 'src_y_1', frame: 10, value: 40, easing: 'linear' }];
  return {
    id: 'src_track', partId: 'src', name: 'Source', color: '#ff0000',
    keyframes: [{ id: 'src_kf_1', frame: 5, transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }],
    channels, visible: true, locked: false, expanded: false,
  };
}

describe('M26 26A — cloneAnimationOntoTarget (target has NO track)', () => {
  it('creates a track with target partId and fresh track id', () => {
    const src = makeSourceTrack();
    const res = cloneAnimationOntoTarget(src, makePart('src', { inAnimPreset: 'fade', inAnimDuration: 12 }), 'tgt', undefined);
    expect(res.track.partId).toBe('tgt');
    expect(res.track.id).not.toBe(src.id);
    expect(res.track.visible).toBe(true);
    expect(res.track.locked).toBe(false);
  });

  it('copies channel keyframes with frame/value/easing/templateId/bezier preserved', () => {
    const res = cloneAnimationOntoTarget(makeSourceTrack(), makePart('src'), 'tgt', undefined);
    expect(res.track.channels.x).toHaveLength(2);
    expect(res.track.channels.x[0]).toMatchObject({ frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' });
    expect(res.track.channels.x[1]).toMatchObject({ frame: 20, value: 100, easing: 'easeInOut', templateId: 'Sequence' });
    expect(res.track.channels.x[1].bezierControlPoints).toEqual([0.2, 0, 0.8, 1]);
    expect(res.track.channels.y[0]).toMatchObject({ frame: 10, value: 40, easing: 'linear' });
  });

  it('generates fresh keyframe ids (source ids never reused)', () => {
    const src = makeSourceTrack();
    const res = cloneAnimationOntoTarget(src, makePart('src'), 'tgt', undefined);
    const srcIds = [...src.channels.x.map((k) => k.id), ...src.channels.y.map((k) => k.id), ...(src.keyframes ?? []).map((k) => k.id)];
    const tgtIds = [...res.track.channels.x.map((k) => k.id), ...res.track.channels.y.map((k) => k.id), ...res.track.keyframes.map((k) => k.id)];
    for (const id of tgtIds) {
      expect(srcIds).not.toContain(id); // no collision with source
    }
    expect(new Set(tgtIds).size).toBe(tgtIds.length); // unique within target
  });

  it('copies legacy keyframes with fresh ids and preserved transform/easing', () => {
    const res = cloneAnimationOntoTarget(makeSourceTrack(), makePart('src'), 'tgt', undefined);
    expect(res.track.keyframes).toHaveLength(1);
    expect(res.track.keyframes[0]).toMatchObject({ frame: 5, easing: 'linear' });
    expect(res.track.keyframes[0].transform).toEqual({ x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
  });

  it('empty source track (channels only) → target gets empty channels', () => {
    const empty: Track = { id: 'e', partId: 'src', name: 'E', color: '#fff', keyframes: [], channels: makeEmptyChannels(), visible: true, locked: false, expanded: false };
    const res = cloneAnimationOntoTarget(empty, makePart('src'), 'tgt', undefined);
    expect(res.track.channels.x).toEqual([]);
    expect(res.track.keyframes).toEqual([]);
  });

  it('no source track → target track is empty but valid', () => {
    const res = cloneAnimationOntoTarget(undefined, makePart('src'), 'tgt', undefined);
    expect(res.track.partId).toBe('tgt');
    expect(res.track.channels.x).toEqual([]);
    expect(res.track.keyframes).toEqual([]);
  });
});

describe('M26 26A — target WITH existing track', () => {
  it('keeps target track id + metadata, replaces only animation data', () => {
    const channels = makeEmptyChannels();
    channels.x = [{ id: 'tgt_x_old', frame: 99, value: 999, easing: 'linear' }];
    const tgt: Track = { id: 'tgt_track', partId: 'tgt', name: 'Target Track', color: '#00ff00', keyframes: [{ id: 'tgt_kf_old', frame: 50, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }], channels, visible: false, locked: true, expanded: true };
    const res = cloneAnimationOntoTarget(makeSourceTrack(), makePart('src'), 'tgt', tgt);
    expect(res.track.id).toBe('tgt_track');
    expect(res.track.name).toBe('Target Track');
    expect(res.track.color).toBe('#00ff00');
    expect(res.track.visible).toBe(false);   // metadata preserved
    expect(res.track.locked).toBe(true);
    expect(res.track.expanded).toBe(true);
    // old animation data replaced by source data
    expect(res.track.channels.x[0].frame).toBe(0);
    expect(res.track.channels.x).toHaveLength(2);
    expect(res.track.keyframes[0].frame).toBe(5);
  });
});

describe('M26 26A — part animation fields (IN/OUT)', () => {
  it('copies inAnimPreset/outAnimPreset/durations from source', () => {
    const src = makePart('src', { inAnimPreset: 'slide-left', outAnimPreset: 'user-1', inAnimDuration: 15, outAnimDuration: 20 });
    const res = cloneAnimationOntoTarget(makeSourceTrack(), src, 'tgt', undefined);
    expect(res.animationFields).toEqual({ inAnimPreset: 'slide-left', outAnimPreset: 'user-1', inAnimDuration: 15, outAnimDuration: 20 });
  });

  it('custom preset IDs are referenced, not duplicated (id string passes through)', () => {
    const src = makePart('src', { inAnimPreset: 'preset_7' });
    const res = cloneAnimationOntoTarget(makeSourceTrack(), src, 'tgt', undefined);
    expect(res.animationFields.inAnimPreset).toBe('preset_7');
  });

  it('absent source fields clear the target (exact animation intent transfer)', () => {
    const src = makePart('src'); // no IN/OUT fields
    const res = cloneAnimationOntoTarget(makeSourceTrack(), src, 'tgt', undefined);
    expect(res.animationFields.inAnimPreset).toBeUndefined();
    expect(res.animationFields.outAnimPreset).toBeUndefined();
  });
});

describe('M26 26A — source immutability + isolation', () => {
  it('source clipboard data is NOT mutated by the transfer', () => {
    const src = makeSourceTrack();
    const srcPart = makePart('src', { inAnimPreset: 'fade' });
    const snapshotTrack = JSON.stringify(src);
    const snapshotPart = JSON.stringify(srcPart);
    cloneAnimationOntoTarget(src, srcPart, 'tgt', undefined);
    expect(JSON.stringify(src)).toBe(snapshotTrack);
    expect(JSON.stringify(srcPart)).toBe(snapshotPart);
  });

  it('target clone does not share mutable references with source', () => {
    const src = makeSourceTrack();
    const res = cloneAnimationOntoTarget(src, makePart('src'), 'tgt', undefined);
    res.track.channels.x[0].value = -1;
    res.track.channels.x[1].frame = 999;
    res.track.keyframes[0].transform.x = -999;
    expect(src.channels.x[0].value).toBe(0);
    expect(src.channels.x[1].frame).toBe(20);
    expect(src.keyframes[0].transform.x).toBe(10);
  });

  it('repeated paste is deterministic in structure but uses fresh ids each time', () => {
    const src = makeSourceTrack();
    const a = cloneAnimationOntoTarget(src, makePart('src'), 'tgt', undefined);
    const b = cloneAnimationOntoTarget(src, makePart('src'), 'tgt', undefined);
    // structure identical (frames/values)
    expect(a.track.channels.x.map((k) => k.frame)).toEqual(b.track.channels.x.map((k) => k.frame));
    expect(a.track.channels.x.map((k) => k.value)).toEqual(b.track.channels.x.map((k) => k.value));
    // ids differ between runs
    expect(a.track.channels.x[0].id).not.toBe(b.track.channels.x[0].id);
    expect(a.track.id).not.toBe(b.track.id);
  });
});

describe('M26 26A — M8 / schema', () => {
  it('channel schema contains the canonical transform, mask, and Trim Path channels', () => {
    const res = cloneAnimationOntoTarget(makeSourceTrack(), makePart('src'), 'tgt', undefined);
    const keys = Object.keys(res.track.channels).sort();
    expect(keys).toEqual(['maskOffsetX', 'maskOffsetY', 'maskRotation', 'maskScale', 'opacity', 'rotation', 'scaleX', 'scaleY', 'trimPathEnd', 'trimPathOffset', 'trimPathStart', 'x', 'y']);
  });

  it('produces a structurally valid Track (all required fields present)', () => {
    const res = cloneAnimationOntoTarget(undefined, makePart('src'), 'tgt', undefined);
    expect(res.track.id).toBeTruthy();
    expect(res.track.partId).toBe('tgt');
    expect(res.track.name).toBeTruthy();
    expect(res.track.color).toBeTruthy();
    expect(Array.isArray(res.track.keyframes)).toBe(true);
    expect(res.track.channels).toBeTruthy();
    expect(typeof res.track.visible).toBe('boolean');
    expect(typeof res.track.locked).toBe('boolean');
  });

  it('transfer does not involve matte/parent/geometry fields at all', () => {
    const src = makeSourceTrack();
    const res = cloneAnimationOntoTarget(src, makePart('src', { parentId: 'PARENT' }), 'tgt', undefined);
    // helper only returns track + animation fields — no part identity fields
    expect(Object.keys(res.animationFields)).toEqual(['inAnimPreset', 'outAnimPreset', 'inAnimDuration', 'outAnimDuration']);
  });
});
