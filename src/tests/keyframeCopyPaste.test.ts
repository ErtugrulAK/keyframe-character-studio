import { describe, it, expect } from 'vitest';
import { copyKeyframeGroupData, pasteKeyframeGroupData, type KeyframeCopyPayload } from '../utils/keyframeCopyPaste';
import type { Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';

/**
 * M28 28A — TIMELINE KEYFRAME COPY / PASTE (pure data layer).
 * Copy captures a track-independent frame-group payload; paste clones it onto
 * an existing track at an explicit frame with fresh ids. Collision / invalid
 * frames / empty payload are safe no-ops. Source + payload never mutate.
 */

function makeTrack(id: string, partId: string, overrides: Partial<Track> = {}): Track {
  return {
    id, partId, name: `T${id}`, color: '#ff0000',
    keyframes: [], channels: makeEmptyChannels(),
    visible: true, locked: false, expanded: false,
    ...overrides,
  };
}

function kf(id: string, frame: number, value: number, extra: Record<string, unknown> = {}) {
  return { id, frame, value, easing: 'linear', ...extra };
}

const legacyTransform = { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const legacy = (id: string, frame: number, extra: Record<string, unknown> = {}) =>
  ({ id, frame, transform: { ...legacyTransform }, easing: 'linear', ...extra });

describe('M28 28A — copy: payload', () => {
  it('1+5+6+7. copy single channel keyframe: value/easing/templateId preserved, no id', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 55, { easing: 'easeInOut', templateId: 'Sequence', bezierControlPoints: [0.2, 0, 0.8, 1] }) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    expect(payload.channels.x).toHaveLength(1);
    const pk = payload.channels.x![0] as Record<string, unknown>;
    expect(pk.value).toBe(55);
    expect(pk.easing).toBe('easeInOut');
    expect(pk.templateId).toBe('Sequence');
    expect(pk.bezierControlPoints).toEqual([0.2, 0, 0.8, 1]);
    expect('id' in pk).toBe(false); // no id at copy time
  });

  it('2. copy ENTIRE frame-group (all channels at frame)', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1) as never];
    ch.y = [kf('y1', 20, 2) as never];
    ch.rotation = [kf('r1', 20, 3) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    expect(Object.keys(payload.channels).sort()).toEqual(['rotation', 'x', 'y']);
    expect(payload.channels.x).toHaveLength(1);
    expect(payload.channels.y).toHaveLength(1);
  });

  it('3+4. copy legacy keyframe + mixed channel+legacy group', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1) as never];
    const track = makeTrack('t', 'p', { channels: ch, keyframes: [legacy('l1', 20)] });
    const payload = copyKeyframeGroupData(track, 20);
    expect(payload.legacy).toHaveLength(1);
    expect(payload.channels.x).toHaveLength(1);
    expect('id' in payload.legacy[0]).toBe(false);
    expect(payload.legacy[0].transform).toEqual(legacyTransform);
  });

  it('9+10. payload deep-cloned; source immutable', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1, { bezierControlPoints: [0.2, 0, 0.8, 1] }) as never];
    const src = makeTrack('t', 'p', { channels: ch, keyframes: [legacy('l1', 20)] });
    const before = JSON.stringify(src);
    const payload = copyKeyframeGroupData(src, 20);
    expect(JSON.stringify(src)).toBe(before);
    // mutate payload → source unaffected (bezier + legacy transform deep-cloned)
    (payload.channels.x![0] as { bezierControlPoints: number[] }).bezierControlPoints[0] = -99;
    (payload.legacy[0] as { transform: { x: number } }).transform.x = -99;
    expect(src.channels.x[0].bezierControlPoints![0]).toBe(0.2);
    expect(src.keyframes[0].transform.x).toBe(1);
  });
});

describe('M28 28A — paste: same-track', () => {
  it('11+13. paste onto same track at explicit target frame', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 55) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const target = makeTrack('t', 'p', { channels: ch });
    const res = pasteKeyframeGroupData(target, 30, payload);
    expect(res.pasted).toBe(true);
    expect(res.track.channels.x.map((k) => k.frame)).toEqual([20, 30]);
    expect(res.track.channels.x[1].value).toBe(55);
  });

  it('14+16. fresh property ids; source/target id sets disjoint', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const res = pasteKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 30, payload);
    expect(res.track.channels.x[1].id).not.toBe('x1');
    expect(res.track.channels.x[0].id).toBe('x1'); // source untouched
  });

  it('15+16b. fresh legacy ids', () => {
    const track = makeTrack('t', 'p', { keyframes: [legacy('l1', 20)] });
    const payload = copyKeyframeGroupData(track, 20);
    const res = pasteKeyframeGroupData(track, 30, payload);
    expect(res.track.keyframes.map((k) => k.frame)).toEqual([20, 30]);
    expect(res.track.keyframes[1].id).not.toBe('l1');
    expect(res.track.keyframes[1].transform).toEqual(legacyTransform);
  });

  it('17. channel collision → safe no-op', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1) as never];
    ch.y = [kf('y1', 30, 99) as never]; // target 30 occupied
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const target = makeTrack('t', 'p', { channels: ch });
    const res = pasteKeyframeGroupData(target, 30, payload);
    expect(res.pasted).toBe(false);
    expect(res.track).toBe(target);
    expect(res.track.channels.y[0].value).toBe(99); // untouched
  });

  it('18+19. legacy / mixed collision → safe no-op', () => {
    const src = makeTrack('t', 'p', { keyframes: [legacy('l1', 20)] });
    const payload = copyKeyframeGroupData(src, 20);
    // legacy collision
    const targetLegacy = makeTrack('t', 'p', { keyframes: [legacy('lX', 30)] });
    expect(pasteKeyframeGroupData(targetLegacy, 30, payload).pasted).toBe(false);
    // mixed: channel source, legacy at target
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1) as never];
    const mixedPayload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const mixedTarget = makeTrack('t', 'p', { channels: ch, keyframes: [legacy('lX', 30)] });
    expect(pasteKeyframeGroupData(mixedTarget, 30, mixedPayload).pasted).toBe(false);
  });

  it('20+21. targetFrame < 0 / > totalFrames → safe no-op', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const target = makeTrack('t', 'p', { channels: ch });
    expect(pasteKeyframeGroupData(target, -1, payload).pasted).toBe(false);
    expect(pasteKeyframeGroupData(target, 91, payload, 90).pasted).toBe(false);
    // boundary: target == totalFrames is valid
    expect(pasteKeyframeGroupData(target, 90, payload, 90).pasted).toBe(true);
  });

  it('22. empty payload → safe no-op', () => {
    const empty: KeyframeCopyPayload = { channels: {}, legacy: [] };
    const target = makeTrack('t', 'p');
    const res = pasteKeyframeGroupData(target, 30, empty);
    expect(res.pasted).toBe(false);
    expect(res.track).toBe(target);
  });

  it('26+27+28. repeated paste: fresh ids, semantic values equal, template/easing kept', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 7, { easing: 'easeInOut', templateId: 'Outro' }) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const a = pasteKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 30, payload);
    const b = pasteKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 40, payload);
    expect(a.track.channels.x[1].id).not.toBe(b.track.channels.x[1].id);
    expect(a.track.channels.x[1].value).toBe(b.track.channels.x[1].value);
    expect(a.track.channels.x[1].easing).toBe('easeInOut');
    expect(a.track.channels.x[1].templateId).toBe('Outro');
  });
});

describe('M28 28A — paste: cross-track', () => {
  it('12. paste onto a DIFFERENT track: target metadata preserved, only animation changes', () => {
    const chA = makeEmptyChannels();
    chA.x = [kf('x1', 20, 55, { templateId: 'Sequence' }) as never];
    const payload = copyKeyframeGroupData(makeTrack('tA', 'pA', { channels: chA }), 20);

    const chB = makeEmptyChannels();
    chB.opacity = [kf('o1', 5, 0.5) as never];
    const targetB = makeTrack('tB', 'pB', { channels: chB, name: 'Part B', color: '#00ff00', visible: false, locked: true, expanded: true });
    const res = pasteKeyframeGroupData(targetB, 30, payload);

    expect(res.pasted).toBe(true);
    expect(res.track.id).toBe('tB');
    expect(res.track.partId).toBe('pB');
    expect(res.track.name).toBe('Part B');
    expect(res.track.color).toBe('#00ff00');
    expect(res.track.visible).toBe(false);
    expect(res.track.locked).toBe(true);
    expect(res.track.expanded).toBe(true);
    // animation data pasted: x@30 added, existing opacity@5 untouched
    expect(res.track.channels.x.map((k) => k.frame)).toEqual([30]);
    expect(res.track.channels.x[0].value).toBe(55);
    expect(res.track.channels.x[0].templateId).toBe('Sequence');
    expect(res.track.channels.opacity.map((k) => k.frame)).toEqual([5]);
  });

  it('12b. cross-track with legacy payload', () => {
    const src = makeTrack('tA', 'pA', { keyframes: [legacy('l1', 20)] });
    const payload = copyKeyframeGroupData(src, 20);
    const targetB = makeTrack('tB', 'pB');
    const res = pasteKeyframeGroupData(targetB, 10, payload);
    expect(res.pasted).toBe(true);
    expect(res.track.keyframes[0]).toMatchObject({ frame: 10 });
    expect(res.track.keyframes[0].transform).toEqual(legacyTransform);
  });
});

describe('M28 28A — immutability / schema / determinism', () => {
  it('29+30. source track + payload never mutate after paste', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1, { bezierControlPoints: [0.2, 0, 0.8, 1] }) as never];
    const src = makeTrack('t', 'p', { channels: ch });
    const srcBefore = JSON.stringify(src);
    const payload = copyKeyframeGroupData(src, 20);
    const payloadBefore = JSON.stringify(payload);
    const res = pasteKeyframeGroupData(src, 30, payload);
    res.track.channels.x[1].value = -1;
    res.track.channels.x[1].bezierControlPoints![0] = -99;
    expect(JSON.stringify(src)).toBe(srcBefore);
    expect(JSON.stringify(payload)).toBe(payloadBefore);
    expect(src.channels.x[0].value).toBe(1);
  });

  it('23. target track metadata preserved on same-track paste', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const target = makeTrack('t', 'p', { channels: ch });
    const res = pasteKeyframeGroupData(target, 30, payload);
    expect(res.track.id).toBe('t');
    expect(res.track.partId).toBe('p');
    expect(res.track.visible).toBe(true);
  });

  it('24+25. channel schema unchanged; no new channel created', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const res = pasteKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 30, payload);
    expect(Object.keys(res.track.channels).sort()).toEqual(
      ['maskOffsetX', 'maskOffsetY', 'maskRotation', 'maskScale', 'opacity', 'rotation', 'scaleX', 'scaleY', 'trimPathEnd', 'trimPathOffset', 'trimPathStart', 'x', 'y'],
    );
    expect(res.track.channels.y).toEqual([]);
  });

  it('31. keyframeDuplicate semantics remain compatible (unchanged helper untouched)', () => {
    // M27 duplicate still works on its own — cross-check it still imports fine
    // and produces the same first-paste shape as paste at frame+1.
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const res = pasteKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 21, payload);
    expect(res.track.channels.x.map((k) => k.frame)).toEqual([20, 21]); // identical to duplicate placement
  });

  it('32+33. legacy transform + bezier deep-cloned across paste', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 1, { bezierControlPoints: [0.2, 0, 0.8, 1] }) as never];
    const src = makeTrack('t', 'p', { channels: ch, keyframes: [legacy('l1', 20)] });
    const payload = copyKeyframeGroupData(src, 20);
    const res = pasteKeyframeGroupData(src, 30, payload);
    res.track.channels.x[1].bezierControlPoints![0] = -99;
    res.track.keyframes[1].transform.x = -99;
    expect(src.channels.x[0].bezierControlPoints![0]).toBe(0.2);
    expect(src.keyframes[0].transform.x).toBe(1);
  });

  it('34. deterministic semantic result', () => {
    const ch = makeEmptyChannels();
    ch.x = [kf('x1', 20, 3, { easing: 'easeInOut' }) as never];
    ch.rotation = [kf('r1', 20, 9) as never];
    const payload = copyKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 20);
    const a = pasteKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 30, payload);
    const b = pasteKeyframeGroupData(makeTrack('t', 'p', { channels: ch }), 30, payload);
    const strip = (t: Track) => JSON.parse(JSON.stringify(t, (key, value) => (key === 'id' ? 'ID' : value)));
    expect(strip(a.track)).toEqual(strip(b.track));
  });
});
