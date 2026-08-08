/**
 * M1 + M2 — Keyframe migration preparation tests
 *
 * M1: updatePropertyKeyframeEasing (channel easing update)
 * M2: convertLegacyKeyframesToChannels (legacy → channels import conversion)
 */

import { describe, test, expect } from 'vitest';
import { updatePropertyKeyframeEasingMutator } from '../utils/trackMutations';
import { convertLegacyKeyframesToChannels } from '../utils/legacyKeyframeConversion';
import { evaluateTransform } from '../utils/evaluateTransform';
import type { Track, TrackChannel, Keyframe } from '../types/animator';

function makeTrackWithChannels(channels: Partial<Record<TrackChannel, any[]>>): Track {
  return {
    id: 'trk_1',
    partId: 'L1',
    name: 'T',
    color: '#f00',
    keyframes: [],
    channels: {
      x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      ...channels,
    },
    visible: true,
    locked: false,
  } as Track;
}

// ─── M1: updatePropertyKeyframeEasing ─────────────────────────────────

describe('M1 — updatePropertyKeyframeEasing', () => {

  test('changes easing of the target channel keyframe only', () => {
    const track = makeTrackWithChannels({
      x: [
        { id: 'pkx1', frame: 0, value: 0, easing: 'linear' },
        { id: 'pkx2', frame: 120, value: 100, easing: 'linear' },
      ],
      y: [
        { id: 'pky1', frame: 0, value: 0, easing: 'linear' },
      ],
    });

    const [updated] = updatePropertyKeyframeEasingMutator([track], 'trk_1', 'x', 'pkx2', 'easeIn');

    // Target keyframe easing changed
    expect(updated.channels.x.find(k => k.id === 'pkx2')!.easing).toBe('easeIn');
    // Other keyframes in same channel untouched
    expect(updated.channels.x.find(k => k.id === 'pkx1')!.easing).toBe('linear');
    // Other channels untouched
    expect(updated.channels.y.find(k => k.id === 'pky1')!.easing).toBe('linear');
    // Values untouched
    expect(updated.channels.x.find(k => k.id === 'pkx2')!.value).toBe(100);
    expect(updated.channels.x.find(k => k.id === 'pkx2')!.frame).toBe(120);
  });

  test('does not touch other tracks', () => {
    const t1 = makeTrackWithChannels({ x: [{ id: 'a', frame: 0, value: 0, easing: 'linear' }] });
    const t2 = makeTrackWithChannels({ x: [{ id: 'b', frame: 0, value: 0, easing: 'linear' }] });
    t2.id = 'trk_2';

    const result = updatePropertyKeyframeEasingMutator([t1, t2], 'trk_1', 'x', 'a', 'bounce');
    expect(result[0].channels.x[0].easing).toBe('bounce');
    expect(result[1].channels.x[0].easing).toBe('linear');
  });

  test('evaluation reflects the new easing (parity via evaluateTransform)', () => {
    const track = makeTrackWithChannels({
      x: [
        { id: 'pkx1', frame: 0, value: 0, easing: 'linear' },
        { id: 'pkx2', frame: 120, value: 100, easing: 'linear' },
      ],
    });
    const layers = [{ id: 'L1', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }] as any;

    // Linear: frame 60 → 50
    const linear = evaluateTransform(layers, [track], 'Sequence', 'L1', 60);
    expect(linear.x).toBeCloseTo(50, 4);

    // Interpolation uses the PREVIOUS keyframe's easing (same as legacy
    // evalComposite — parity). Set pkx1 to easeIn → frame 60 lands < 50.
    const [updated] = updatePropertyKeyframeEasingMutator([track], 'trk_1', 'x', 'pkx1', 'easeIn');
    const eased = evaluateTransform(layers, [updated], 'Sequence', 'L1', 60);
    expect(eased.x).toBeLessThan(50);
    expect(eased.x).toBeGreaterThan(0);
  });

  test('legacy easing update mutator still works (regression)', () => {
    // M7 Step 4 removed the legacy updateKeyframeEasing API entirely; verify
    // the channel easing mutator leaves the legacy keyframes array untouched.
    const track = makeTrackWithChannels({ x: [{ id: 'pkx1', frame: 0, value: 0, easing: 'linear' }] });
    track.keyframes = [
      { id: 'kf1', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'easeOut' },
    ];

    const [updated] = updatePropertyKeyframeEasingMutator([track], 'trk_1', 'x', 'pkx1', 'bounce');
    // Legacy keyframes array untouched by channel operation
    expect(updated.keyframes[0].easing).toBe('easeOut');
    // Channel updated
    expect(updated.channels.x[0].easing).toBe('bounce');
  });
});

// ─── M2: convertLegacyKeyframesToChannels ──────────────────────────────

describe('M2 — convertLegacyKeyframesToChannels', () => {

  function legacyKf(overrides: Partial<Keyframe>): Keyframe {
    return {
      id: 'kf',
      frame: 0,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      easing: 'linear',
      ...overrides,
    } as Keyframe;
  }

  test('converts all 6 animated properties with frame + easing', () => {
    const kfs = [
      legacyKf({ id: 'kf0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }),
      legacyKf({ id: 'kf1', frame: 120, transform: { x: 100, y: 200, rotation: 30, scaleX: 2, scaleY: 3, opacity: 0.5 }, easing: 'easeIn' }),
    ];

    const channels = convertLegacyKeyframesToChannels(kfs);

    expect(channels.x).toHaveLength(2);
    expect(channels.y).toHaveLength(2);
    expect(channels.rotation).toHaveLength(2);
    expect(channels.scaleX).toHaveLength(2);
    expect(channels.scaleY).toHaveLength(2);
    expect(channels.opacity).toHaveLength(2);

    expect(channels.x[1].frame).toBe(120);
    expect(channels.x[1].value).toBe(100);
    expect(channels.y[1].value).toBe(200);
    expect(channels.rotation[1].value).toBe(30);
    expect(channels.opacity[1].value).toBeCloseTo(0.5, 5);
    // easing carried over
    expect(channels.x[1].easing).toBe('easeIn');
  });

  test('opacity 0 is preserved', () => {
    const kfs = [legacyKf({ id: 'kf0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 } })];
    const channels = convertLegacyKeyframesToChannels(kfs);
    expect(channels.opacity[0].value).toBe(0);
  });

  test('templateId is preserved', () => {
    const kfs = [legacyKf({ id: 'kf0', frame: 10, templateId: 'Outro', transform: { x: 5, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const channels = convertLegacyKeyframesToChannels(kfs);
    expect(channels.x[0].templateId).toBe('Outro');
  });

  test('no duplicate channel keyframes for same frame + template', () => {
    const kfs = [
      legacyKf({ id: 'kf_a', frame: 60, transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }),
      legacyKf({ id: 'kf_b', frame: 60, transform: { x: 99, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }),
    ];
    const channels = convertLegacyKeyframesToChannels(kfs);
    expect(channels.x).toHaveLength(1);
    // First occurrence wins (deterministic)
    expect(channels.x[0].value).toBe(10);
  });

  test('deterministic: same input → identical output', () => {
    const kfs = [
      legacyKf({ id: 'kf0', frame: 0, transform: { x: 0, y: 5, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'easeInOut' }),
      legacyKf({ id: 'kf1', frame: 90, transform: { x: 40, y: -5, rotation: 15, scaleX: 1.5, scaleY: 1, opacity: 0.7 }, easing: 'bounce' }),
    ];
    const a = convertLegacyKeyframesToChannels(kfs);
    const b = convertLegacyKeyframesToChannels(kfs);
    expect(b).toEqual(a);
  });

  test('empty input → empty channels', () => {
    const channels = convertLegacyKeyframesToChannels([]);
    expect(channels.x).toHaveLength(0);
    expect(channels.opacity).toHaveLength(0);
  });

  test('bezier control points carried over', () => {
    const kfs = [legacyKf({ id: 'kf0', frame: 0, easing: 'cubic_bezier', bezierControlPoints: [0.2, 0.4, 0.6, 0.8], transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const channels = convertLegacyKeyframesToChannels(kfs);
    expect(channels.x[0].bezierControlPoints).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(channels.x[0].easing).toBe('cubic_bezier');
  });

  test('M8b: maskOffset values migrate to their canonical channels', () => {
    const kfs = [legacyKf({
      id: 'kf0', frame: 10,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        maskOffsetX: 25, maskOffsetY: -40, maskScale: 1.5, maskRotation: 90 },
    })];
    const channels = convertLegacyKeyframesToChannels(kfs);

    expect(channels.maskOffsetX).toHaveLength(1);
    expect(channels.maskOffsetX[0].value).toBe(25);
    expect(channels.maskOffsetY[0].value).toBe(-40);
    expect(channels.maskScale[0].value).toBe(1.5);
    expect(channels.maskRotation[0].value).toBe(90);
    expect(channels.maskOffsetX[0].frame).toBe(10);
  });

  test('M8b: defined maskOffset 0 is preserved (not dropped)', () => {
    const kfs = [legacyKf({
      id: 'kf0', frame: 0,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        maskOffsetX: 0, maskOffsetY: 0, maskScale: 1, maskRotation: 0 },
    })];
    const channels = convertLegacyKeyframesToChannels(kfs);

    expect(channels.maskOffsetX).toHaveLength(1);
    expect(channels.maskOffsetX[0].value).toBe(0);
    expect(channels.maskOffsetY[0].value).toBe(0);
    expect(channels.maskScale[0].value).toBe(1);
    expect(channels.maskRotation[0].value).toBe(0);
  });

  test('M8b: undefined maskOffset fields are skipped (no invented keyframes)', () => {
    const kfs = [legacyKf({
      id: 'kf0', frame: 0,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, maskOffsetX: 5 },
    })];
    const channels = convertLegacyKeyframesToChannels(kfs);

    expect(channels.maskOffsetX).toHaveLength(1);
    expect(channels.maskOffsetY).toHaveLength(0);
    expect(channels.maskScale).toHaveLength(0);
    expect(channels.maskRotation).toHaveLength(0);
  });

  test('M8b: templateId carried to mask channels', () => {
    const kfs = [legacyKf({
      id: 'kf0', frame: 10, templateId: 'Outro',
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, maskOffsetX: 5 },
    })];
    const channels = convertLegacyKeyframesToChannels(kfs);
    expect(channels.maskOffsetX[0].templateId).toBe('Outro');
  });

  test('M8b: duplicate maskOffset keyframes deduped (first wins, deterministic)', () => {
    const kfs = [
      legacyKf({ id: 'kf_a', frame: 60, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, maskOffsetX: 10 } }),
      legacyKf({ id: 'kf_b', frame: 60, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, maskOffsetX: 99 } }),
    ];
    const channels = convertLegacyKeyframesToChannels(kfs);
    expect(channels.maskOffsetX).toHaveLength(1);
    expect(channels.maskOffsetX[0].value).toBe(10);

    // deterministic: same input → identical output
    expect(convertLegacyKeyframesToChannels(kfs)).toEqual(channels);
  });

  test('M8b: legacy-only import regression — no mask fields still yields 6 channels only', () => {
    const kfs = [legacyKf({ id: 'kf0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })];
    const channels = convertLegacyKeyframesToChannels(kfs);

    // 6 main channels populated, mask channels empty — same as before M8b
    expect(channels.x).toHaveLength(1);
    expect(channels.opacity).toHaveLength(1);
    expect(channels.maskOffsetX).toHaveLength(0);
    expect(channels.maskScale).toHaveLength(0);
  });

  test('M8f: undefined opacity defaults to 1 in conversion; 0 preserved', () => {
    // keyframe WITHOUT opacity field → channel value defaults to 1
    const noOpacity = [legacyKf({ id: 'kf0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } })];
    const channels = convertLegacyKeyframesToChannels(noOpacity);
    expect(channels.opacity).toHaveLength(1);
    expect(channels.opacity[0].value).toBe(1);

    // keyframe WITH opacity 0 → preserved (not coerced to 1)
    const zeroOpacity = [legacyKf({ id: 'kf1', frame: 5, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 } })];
    const channels0 = convertLegacyKeyframesToChannels(zeroOpacity);
    expect(channels0.opacity[0].value).toBe(0);

    // opacity 0.5 unaffected
    const halfOpacity = [legacyKf({ id: 'kf2', frame: 10, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.5 } })];
    expect(convertLegacyKeyframesToChannels(halfOpacity).opacity[0].value).toBeCloseTo(0.5, 5);
  });
});
