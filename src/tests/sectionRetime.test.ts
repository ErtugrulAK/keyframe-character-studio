import { describe, expect, it } from 'vitest';
import type { PropertyKeyframe, Track } from '../types/animator';
import { retimeFrame, retimeSection, sectionAt, sequenceSections } from '../utils/animation/sectionRetime';

const key = (id: string, frame: number, extra: Partial<PropertyKeyframe> = {}): PropertyKeyframe => ({ id, frame, value: frame, easing: 'linear', ...extra });
const track = (id: string, x: PropertyKeyframe[], extra: Partial<Track> = {}): Track => ({
  id, partId: `p_${id}`, name: id, color: '#fff', visible: true, locked: false, keyframes: [],
  channels: { x } as Track['channels'], ...extra,
} as Track);
const frames = (t: Track) => t.channels!.x.map((k) => [k.id, k.frame]);
const run = (tracks: Track[], markers: number[] | undefined, durationFrames: number, frame: number, length: number) =>
  retimeSection({ tracks, templateId: 'Sequence', markers, durationFrames, section: sectionAt(markers, durationFrames, frame), length, maxDurationFrames: 2400 });

describe('sequence sections', () => {
  it('splits a sequence at its markers; a playhead on a marker opens the next section', () => {
    expect(sequenceSections([40, 90], 120)).toEqual([{ index: 0, start: 0, end: 40 }, { index: 1, start: 40, end: 90 }, { index: 2, start: 90, end: 120 }]);
    expect(sectionAt([40, 90], 120, 40).index).toBe(1);
    expect(sectionAt([40, 90], 120, 39).index).toBe(0);
    expect(sectionAt([40, 90], 120, 120).index).toBe(2);
    expect(sectionAt(undefined, 60, 30)).toEqual({ index: 0, start: 0, end: 60 });
  });

  it('maps frames: before stays, inside scales from the start, after moves by the difference', () => {
    expect(retimeFrame(10, 40, 90, 100)).toBe(10);
    expect(retimeFrame(40, 40, 90, 100)).toBe(40);
    expect(retimeFrame(65, 40, 90, 100)).toBe(90);
    expect(retimeFrame(90, 40, 90, 100)).toBe(140);
    expect(retimeFrame(100, 40, 90, 100)).toBe(150);
  });
});

describe('retimeSection', () => {
  it('stretches the middle step: its keys scale, later keys and markers move, the sequence grows', () => {
    const before = [track('a', [key('a0', 0), key('a40', 40), key('a65', 65), key('a90', 90), key('a110', 110)])];
    const result = run(before, [40, 90], 120, 50, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(frames(result.tracks[0])).toEqual([['a0', 0], ['a40', 40], ['a65', 90], ['a90', 140], ['a110', 160]]);
    expect(result.markers).toEqual([40, 140]);
    expect(result.durationFrames).toBe(170);
    // Values and easing are the keys' own.
    expect(result.tracks[0].channels!.x.map((k) => k.value)).toEqual([0, 40, 65, 90, 110]);
  });

  it('squeezes the whole sequence when it has no markers', () => {
    const result = run([track('a', [key('a0', 0), key('a30', 30), key('a60', 60)])], undefined, 60, 10, 30);
    expect(result.ok && frames(result.tracks[0])).toEqual([['a0', 0], ['a30', 15], ['a60', 30]]);
    expect(result.ok && result.durationFrames).toBe(30);
    expect(result.ok && result.markers).toEqual([]);
  });

  it('leaves the other sequences, mask and legacy keys follow the same mapping', () => {
    const t = track('a', [key('a20', 20), key('out20', 20, { templateId: 'Out' })], {
      maskChannels: { 'm:opacity': [key('m20', 20)] } as Track['maskChannels'],
      keyframes: [{ id: 'l20', frame: 20, easing: 'linear', transform: {} } as never],
    });
    const result = run([t], undefined, 40, 0, 80);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(frames(result.tracks[0])).toEqual([['a20', 40], ['out20', 20]]);
    expect((result.tracks[0].maskChannels as Record<string, PropertyKeyframe[]>)['m:opacity'][0].frame).toBe(40);
    expect(result.tracks[0].keyframes[0].frame).toBe(40);
  });

  it('refuses, changing nothing, when two keys would share a frame', () => {
    const before = [track('a', [key('a0', 0), key('a1', 1), key('a2', 2), key('a60', 60)])];
    expect(run(before, undefined, 60, 0, 10)).toEqual({ ok: false, reason: 'collision', trackId: 'a' });
  });

  it('refuses to move a locked layer\'s keys, but a locked layer with nothing to move is fine', () => {
    expect(run([track('a', [key('a30', 30)], { locked: true })], undefined, 60, 0, 120)).toEqual({ ok: false, reason: 'locked', trackId: 'a' });
    expect(run([track('a', [key('a0', 0)], { locked: true })], undefined, 60, 0, 120).ok).toBe(true);
  });

  it('refuses a length under one frame or past the longest sequence; the same length is no change', () => {
    const tracks = [track('a', [key('a30', 30)])];
    expect(run(tracks, undefined, 60, 0, 0)).toEqual({ ok: false, reason: 'invalid' });
    expect(run(tracks, undefined, 60, 0, 3000)).toEqual({ ok: false, reason: 'invalid' });
    const same = run(tracks, undefined, 60, 0, 60);
    expect(same.ok && same.changed).toBe(false);
    expect(same.ok && same.tracks).toBe(tracks);
  });
});
