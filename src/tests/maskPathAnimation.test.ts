import { describe, expect, test } from 'vitest';
import type { BezierPath, Track } from '../types/animator';
import { layerMaskPathChannel } from '../types/animator';
import { interpolatePathChannel } from '../utils/defaults';
import {
  addMaskPathKeyframeMutator,
  deleteMaskPathKeyframeMutator,
  updateMaskPathKeyframeFrameMutator,
  updateMaskPathKeyframeValueMutator,
} from '../utils/trackMutations';
import { evaluateLayerMasks } from '../utils/evaluateLayerMasks';

const path = (x: number, handleOut = false): BezierPath => ({
  version: 1,
  coordinateSpace: 'normalized',
  closed: true,
  points: [
    { id: 'a', x, y: 0.2, ...(handleOut ? { handleOut: { x: x + 0.1, y: 0.2 } } : {}) },
    { id: 'b', x: 0.8, y: 0.8, ...(handleOut ? { handleIn: { x: 0.7, y: 0.8 } } : {}) },
  ],
});

const track = (): Track => ({
  id: 'track-1',
  partId: 'part-1',
  name: 'Track',
  color: '#fff',
  visible: true,
  locked: false,
  channels: {
    x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
    maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
    trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
  },
});

describe('V6 mask path animation', () => {
  test('interpolates compatible vertex IDs and tangent handles', () => {
    const result = interpolatePathChannel([
      { id: 'start', frame: 0, value: path(0.2, true), easing: 'linear' },
      { id: 'end', frame: 10, value: path(0.4, true), easing: 'linear' },
    ], 5, path(0.2));

    expect(result.points[0].x).toBeCloseTo(0.3, 6);
    expect(result.points[0].id).toBe('a');
    expect(result.points[0].handleOut).toEqual({ x: 0.4, y: 0.2 });
    expect(result.points[1].handleIn).toEqual({ x: 0.7, y: 0.8 });
  });

  test('holds the previous path when topology or closed state differs', () => {
    const previous = path(0.2);
    const incompatible = { ...path(0.4), closed: false, points: [...path(0.4).points, { id: 'c', x: 0.5, y: 0.5 }] };
    expect(interpolatePathChannel([
      { id: 'start', frame: 0, value: previous, easing: 'linear' },
      { id: 'end', frame: 10, value: incompatible, easing: 'linear' },
    ], 5, previous)).toBe(previous);
  });

  test('authors, moves, edits, evaluates, and deletes path keys on the canonical track', () => {
    const channel = layerMaskPathChannel('mask-1');
    const start = addMaskPathKeyframeMutator([track()], 'track-1', channel, 0, path(0.2), 'linear', 'Sequence')[0];
    const keyed = addMaskPathKeyframeMutator([start], 'track-1', channel, 10, path(0.4, true), 'linear', 'Sequence')[0];
    const moved = updateMaskPathKeyframeFrameMutator([keyed], 'track-1', channel, keyed.maskPathChannels![channel][1].id, 12)[0];
    const edited = updateMaskPathKeyframeValueMutator([moved], 'track-1', channel, moved.maskPathChannels![channel][1].id, path(0.5, true))[0];
    const part = {
      id: 'part-1',
      name: 'Part',
      type: 'custom_rect' as const,
      zIndex: 0,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      masks: [{ id: 'mask-1', name: 'Mask', path: path(0.2), mode: 'add' as const }],
    };

    const evaluated = evaluateLayerMasks(part, edited, 6);
    expect(evaluated?.[0].path.points[0].x).toBeCloseTo(0.35, 4);
    expect(evaluated?.[0].path.points[0].handleOut).toEqual({ x: 0.4, y: 0.2 });

    const deleted = deleteMaskPathKeyframeMutator([edited], 'track-1', channel, edited.maskPathChannels![channel][0].id)[0];
    expect(deleted.maskPathChannels![channel]).toHaveLength(1);
  });
});
