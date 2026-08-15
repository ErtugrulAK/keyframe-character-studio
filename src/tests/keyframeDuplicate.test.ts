import { describe, it, expect } from 'vitest';
import { duplicateKeyframeGroup } from '../utils/keyframeDuplicate';
import type { Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';

/**
 * M27 27A — TIMELINE KEYFRAME FRAME-GROUP DUPLICATE (pure data layer).
 * Source track must stay immutable; duplicates land at sourceFrame + offset
 * with fresh ids; collisions/no-data/overflow are safe no-ops.
 */

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 't1', partId: 'p1', name: 'Track', color: '#ff0000',
    keyframes: [], channels: makeEmptyChannels(),
    visible: true, locked: false, expanded: false,
    ...overrides,
  };
}

function kf(id: string, frame: number, overrides: Record<string, unknown> = {}) {
  return { id, frame, value: 0, easing: 'linear', ...overrides };
}

describe('M27 27A — basic duplicate', () => {
  it('1. duplicates a single channel keyframe onto frame + 1', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10, { value: 55 }) as never];
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch }), 10);
    expect(res.duplicated).toBe(true);
    expect(res.track.channels.x.map((k) => k.frame)).toEqual([10, 11]);
    expect(res.track.channels.x[1].value).toBe(55);
  });

  it('2. frame-group: duplicates ALL channels at the same frame', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    ch.y = [kf('y1', 10) as never];
    ch.rotation = [kf('r1', 10) as never];
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch }), 10);
    for (const channel of ['x', 'y', 'rotation'] as const) {
      expect(res.track.channels[channel].map((k) => k.frame)).toEqual([10, 11]);
    }
  });

  it('3+4+5+6. values / easing / templateId / bezierControlPoints preserved', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10, { value: 42, easing: 'easeInOut', templateId: 'Sequence', bezierControlPoints: [0.2, 0, 0.8, 1] }) as never];
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch }), 10);
    expect(res.track.channels.x[1]).toMatchObject({
      frame: 11, value: 42, easing: 'easeInOut', templateId: 'Sequence', bezierControlPoints: [0.2, 0, 0.8, 1],
    });
  });

  it('7. fresh property keyframe ids (source ids never reused)', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    ch.y = [kf('y1', 10) as never];
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch }), 10);
    const sourceIds = ['x1', 'y1'];
    const targetIds = [res.track.channels.x[1].id, res.track.channels.y[1].id];
    for (const id of targetIds) expect(sourceIds).not.toContain(id);
  });

  it('8+9. legacy keyframes duplicated with fresh ids, source ids not reused', () => {
    const legacy = [{ id: 'kf_legacy_1', frame: 10, transform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }];
    const res = duplicateKeyframeGroup(makeTrack({ keyframes: legacy }), 10);
    expect(res.track.keyframes).toHaveLength(2);
    expect(res.track.keyframes[1].frame).toBe(11);
    expect(res.track.keyframes[1].id).not.toBe('kf_legacy_1');
  });

  it('10. legacy keyframe transform preserved', () => {
    const legacy = [{ id: 'k', frame: 10, transform: { x: 7, y: 8, rotation: 9, scaleX: 2, scaleY: 3, opacity: 0.5 }, easing: 'linear' }];
    const res = duplicateKeyframeGroup(makeTrack({ keyframes: legacy }), 10);
    expect(res.track.keyframes[1].transform).toEqual({ x: 7, y: 8, rotation: 9, scaleX: 2, scaleY: 3, opacity: 0.5 });
  });

  it('11. no legacy keyframe manufactured when absent', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch, keyframes: [] }), 10);
    expect(res.track.keyframes).toEqual([]);
  });

  it('12. mixed channel + legacy group duplicated together', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    const legacy = [{ id: 'k', frame: 10, transform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }];
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch, keyframes: legacy }), 10);
    expect(res.track.channels.x.map((k) => k.frame)).toEqual([10, 11]);
    expect(res.track.keyframes).toHaveLength(2);
    expect(res.track.keyframes[1].frame).toBe(11);
  });
});

describe('M27 27A — immutability', () => {
  it('12. source track immutable (JSON identical)', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10, { bezierControlPoints: [0.2, 0, 0.8, 1] }) as never];
    const src = makeTrack({ channels: ch });
    const before = JSON.stringify(src);
    duplicateKeyframeGroup(src, 10);
    expect(JSON.stringify(src)).toBe(before);
  });

  it('13. duplicate does not share mutable references (bezier + legacy transform)', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10, { bezierControlPoints: [0.2, 0, 0.8, 1] }) as never];
    const legacy = [{ id: 'k', frame: 10, transform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }];
    const src = makeTrack({ channels: ch, keyframes: legacy });
    const res = duplicateKeyframeGroup(src, 10);
    res.track.channels.x[1].bezierControlPoints![0] = -99;
    res.track.keyframes[1].transform.x = -99;
    expect(src.channels.x[0].bezierControlPoints![0]).toBe(0.2);
    expect(src.keyframes[0].transform.x).toBe(1);
  });
});

describe('M27 27A — offset / bounds / collisions', () => {
  it('14. target frame = source + 1 (MVP offset)', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch }), 10);
    expect(res.track.channels.x[1].frame).toBe(11);
  });

  it('14b. custom offset respected when provided', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch }), 10, 5);
    expect(res.track.channels.x[1].frame).toBe(15);
  });

  it('15. totalFrames overflow → safe no-op', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 89) as never];
    const src = makeTrack({ channels: ch });
    // 89 → 90 is still a valid frame (clamp upper bound = totalFrames)
    expect(duplicateKeyframeGroup(src, 89, 1, 90).duplicated).toBe(true);
    expect(duplicateKeyframeGroup(src, 89, 1, 90).track.channels.x.map((k) => k.frame)).toEqual([89, 90]);
    // 90 → 91 exceeds totalFrames → no-op
    ch.x = [kf('x1', 90) as never];
    const srcAtBound = makeTrack({ channels: ch });
    const res = duplicateKeyframeGroup(srcAtBound, 90, 1, 90);
    expect(res.duplicated).toBe(false);
    expect(res.track).toBe(srcAtBound); // untouched
  });

  it('16. source frame with no keyframe → safe no-op', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    const src = makeTrack({ channels: ch });
    const res = duplicateKeyframeGroup(src, 40);
    expect(res.duplicated).toBe(false);
    expect(res.track).toBe(src);
  });

  it('17. existing target-frame collision → safe no-op (never overwrite)', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    ch.y = [kf('y1', 11) as never]; // target frame 11 already has a keyframe
    const src = makeTrack({ channels: ch });
    const res = duplicateKeyframeGroup(src, 10);
    expect(res.duplicated).toBe(false);
    expect(res.track).toBe(src);
    // nothing on frame 11 was touched
    expect(res.track.channels.y[0].frame).toBe(11);
    expect(res.track.channels.x).toHaveLength(1);
  });

  it('17b. legacy collision on target frame → safe no-op', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    const legacy = [{ id: 'k', frame: 11, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }];
    const src = makeTrack({ channels: ch, keyframes: legacy });
    const res = duplicateKeyframeGroup(src, 10);
    expect(res.duplicated).toBe(false);
  });

  it('26. negative frame input → safe no-op', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 0) as never];
    const src = makeTrack({ channels: ch });
    expect(duplicateKeyframeGroup(src, -5).duplicated).toBe(false);
    expect(duplicateKeyframeGroup(src, -1, 1, 90).duplicated).toBe(false);
  });
});

describe('M27 27A — determinism / schema / metadata', () => {
  it('18. repeated duplicate creates distinct fresh ids each time', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    const src = makeTrack({ channels: ch });
    const a = duplicateKeyframeGroup(src, 10);
    const b = duplicateKeyframeGroup(src, 10);
    expect(a.track.channels.x[1].id).not.toBe(b.track.channels.x[1].id);
    expect(a.track.channels.x[1].frame).toBe(b.track.channels.x[1].frame);
    expect(a.track.channels.x[1].value).toBe(b.track.channels.x[1].value);
  });

  it('19. channel schema unchanged (only the 10 known TrackChannels)', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch }), 10);
    expect(Object.keys(res.track.channels).sort()).toEqual(
      ['maskOffsetX', 'maskOffsetY', 'maskRotation', 'maskScale', 'opacity', 'rotation', 'scaleX', 'scaleY', 'x', 'y'],
    );
  });

  it('20+21+22. track metadata / id / partId unchanged', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    const src = makeTrack({ channels: ch });
    const res = duplicateKeyframeGroup(src, 10);
    expect(res.track.id).toBe('t1');
    expect(res.track.partId).toBe('p1');
    expect(res.track.name).toBe('Track');
    expect(res.track.color).toBe('#ff0000');
    expect(res.track.visible).toBe(true);
    expect(res.track.locked).toBe(false);
  });

  it('23. channels without keyframes at source frame left untouched', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10) as never];
    ch.opacity = [kf('o1', 5) as never]; // different frame — untouched
    const res = duplicateKeyframeGroup(makeTrack({ channels: ch }), 10);
    expect(res.track.channels.opacity).toHaveLength(1);
    expect(res.track.channels.opacity[0].frame).toBe(5);
    expect(res.track.channels.y).toEqual([]);
  });

  it('24. deterministic semantic output', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 10, { value: 3 }) as never];
    ch.rotation = [kf('r1', 10, { value: 9, easing: 'easeInOut' }) as never];
    const src = makeTrack({ channels: ch });
    const a = duplicateKeyframeGroup(src, 10);
    const b = duplicateKeyframeGroup(src, 10);
    const strip = (t: Track) => JSON.parse(JSON.stringify(t, (key, value) => (key === 'id' ? 'ID' : value)));
    expect(strip(a.track)).toEqual(strip(b.track));
  });
});
