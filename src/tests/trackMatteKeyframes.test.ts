/**
 * Manual QA round 4: a Track Matte's feather and strength can be keyed, as in
 * After Effects (each property its own keyframes). The record holds the static
 * values; the `matteFeather` / `matteStrength` channels animate them.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterPart, PropertyKeyframe, Track, TrackMatteV2 } from '../types/animator';
import { evaluateTrackMatte } from '../utils/layers/matte';
import { evaluateFrame } from '../utils/animation/evaluateFrame';
import { fillChannelsFromLegacyKeyframes } from '../utils/animation/legacyKeyframeConversion';
import { applyChannelStaticValue, channelArmValue } from '../utils/animation/channelKeyframeGroups';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { laneContextOf, resolveLaneRows } from '../components/Timeline/timelineLaneLayout';
const createRuntime = () => ({ appMode: 'edit' as const, broadcast: {}, liveStunts: {} });

const keys = (values: [number, number][], templateId?: string): PropertyKeyframe[] =>
  values.map(([frame, value]) => ({ id: `k${frame}`, frame, value, easing: 'linear', ...(templateId ? { templateId } : {}) }));

const matte: TrackMatteV2 = { sourceLayerId: 'src', mode: 'alpha', feather: 4, strength: 0.8 };

const part = (trackMatte?: TrackMatteV2): CharacterPart => ({
  id: 'tgt', name: 'Box', type: 'custom_rect', zIndex: 1, pivot: { x: 0, y: 0 }, fillColor: '#fff', strokeColor: '#000',
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, trackMatte,
} as CharacterPart);

describe('evaluateTrackMatte', () => {
  it('interpolates keyed feather and strength and keeps the rest of the record', () => {
    const track = { channels: { ...makeEmptyChannels(), matteFeather: keys([[0, 0], [20, 10]]), matteStrength: keys([[0, 1], [20, 0.5]]) } };
    expect(evaluateTrackMatte(matte, track, 10, 'Sequence')).toEqual({ ...matte, feather: 5, strength: 0.75 });
    expect(evaluateTrackMatte(matte, track, 30, 'Sequence')).toEqual({ ...matte, feather: 10, strength: 0.5 });
  });

  it('is the same record when nothing is keyed in the active sequence', () => {
    expect(evaluateTrackMatte(matte, { channels: makeEmptyChannels() }, 10, 'Sequence')).toBe(matte);
    const other = { channels: { ...makeEmptyChannels(), matteFeather: keys([[0, 0], [20, 10]], 'Named') } };
    expect(evaluateTrackMatte(matte, other, 10, 'Sequence')).toBe(matte);
    expect(evaluateTrackMatte(matte, other, 10, 'Named')?.feather).toBe(5);
    expect(evaluateTrackMatte(undefined, other, 10, 'Named')).toBeUndefined();
  });

  it('clamps an overshoot instead of falling back to full strength', () => {
    const track = { channels: { ...makeEmptyChannels(), matteFeather: keys([[0, -5]]), matteStrength: keys([[0, 1.4]]) } };
    expect(evaluateTrackMatte(matte, track, 0, 'Sequence')).toEqual({ ...matte, feather: 0, strength: 1 });
    const below = { channels: { ...makeEmptyChannels(), matteStrength: keys([[0, -0.2]]) } };
    expect(evaluateTrackMatte(matte, below, 0, 'Sequence')?.strength).toBe(0);
  });
});

describe('the keyed matte through the pipeline', () => {

  it('evaluateFrame hands the renderers the matte at that frame', () => {
    const track = { id: 't', partId: 'tgt', name: 'Box', keyframes: [], channels: { ...makeEmptyChannels(), matteFeather: keys([[0, 0], [20, 10]]) } } as unknown as Track;
    const frame = evaluateFrame([part(matte)], [track], 60, 10, createRuntime(), [], undefined, 'Sequence');
    expect(frame.layers[0].content.trackMatte?.feather).toBe(5);
    expect(frame.layers[0].content.trackMatte?.strength).toBe(0.8);
  });

  it('a save keeps the matte keys next to legacy keyframes', () => {
    const channels = { ...makeEmptyChannels(), matteFeather: keys([[0, 0], [20, 10]]), matteStrength: keys([[5, 0.5]]) };
    const filled = fillChannelsFromLegacyKeyframes(channels, []);
    expect(filled.matteFeather).toEqual(channels.matteFeather);
    expect(filled.matteStrength).toEqual(channels.matteStrength);
  });

  it('arming reads the static value; disarming writes it back, clamped, only onto a Track Matte', () => {
    const transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    expect(channelArmValue('matteFeather', transform, part(matte))).toBe(4);
    expect(channelArmValue('matteStrength', transform, part({ ...matte, strength: undefined }))).toBe(1);
    expect(applyChannelStaticValue(part(matte), 'matteFeather', 12).trackMatte?.feather).toBe(12);
    expect(applyChannelStaticValue(part(matte), 'matteStrength', 3).trackMatte?.strength).toBe(1);
    const plain = part();
    expect(applyChannelStaticValue(plain, 'matteFeather', 12)).toBe(plain);
  });
});

describe('the Track Matte rows on the timeline', () => {
  const track = (channels: Partial<Track['channels']> = {}) => ({ id: 't', partId: 'tgt', expanded: true, keyframes: [], channels: { ...makeEmptyChannels(), ...channels } }) as unknown as Track;
  const labels = (rows: ReturnType<typeof resolveLaneRows>) => rows.map((row) => (row.kind === 'header' ? `[${row.label}]` : row.kind === 'channel' ? row.channel : 'layer'));

  it('show Feather and Strength under Track Matte when the layer has one, or still holds its keys', () => {
    expect(labels(resolveLaneRows(track(), () => true, laneContextOf(part(matte))))).toEqual(expect.arrayContaining(['[Track Matte]', 'matteFeather', 'matteStrength']));
    expect(labels(resolveLaneRows(track(), () => true, laneContextOf(part())))).not.toContain('[Track Matte]');
    expect(labels(resolveLaneRows(track({ matteStrength: keys([[0, 1]]) }), () => true, laneContextOf(part())))).toContain('[Track Matte]');
  });
});
