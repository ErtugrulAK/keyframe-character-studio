import { describe, expect, it } from 'vitest';
import { resolveSceneAdjacentKeyframeFrame } from '../utils/editor/keyframeNavigation';
import type { PropertyKeyframe, Track, TrackChannel } from '../types/animator';

const pk = (id: string, frame: number, templateId = 'Sequence'): PropertyKeyframe =>
  ({ id, frame, value: 0, easing: 'linear', templateId }) as PropertyKeyframe;

const track = (id: string, channels: Partial<Record<TrackChannel, PropertyKeyframe[]>>): Track => ({
  id,
  partId: `part_${id}`,
  name: id,
  color: '#f00',
  keyframes: [],
  channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [], maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [], ...channels },
  visible: true,
  locked: false,
}) as Track;

const tracks = [
  track('a', { x: [pk('a1', 10), pk('a2', 40)] }),
  track('b', { opacity: [pk('b1', 25), pk('b2', 60)], y: [pk('b3', 60)] }),
  track('c', { x: [pk('c1', 30, 'Other')] }),
];

describe('scene keyframe navigation (Ctrl+Left / Ctrl+Right)', () => {
  it('walks every layer of the active sequence when nothing is selected', () => {
    const at = (frame: number, direction: 'previous' | 'next') =>
      resolveSceneAdjacentKeyframeFrame({ tracks, parts: [], activeTemplateId: 'Sequence', partIds: [], frame, direction });
    expect(at(0, 'next')).toBe(10);
    expect(at(10, 'next')).toBe(25);
    expect(at(25, 'next')).toBe(40);
    expect(at(40, 'next')).toBe(60);
    expect(at(60, 'next')).toBeNull();
    expect(at(60, 'previous')).toBe(40);
    expect(at(11, 'previous')).toBe(10);
    expect(at(10, 'previous')).toBeNull();
  });

  it('walks only the selected layers when there is a selection', () => {
    const at = (frame: number, direction: 'previous' | 'next') =>
      resolveSceneAdjacentKeyframeFrame({ tracks, parts: [], activeTemplateId: 'Sequence', partIds: ['part_b'], frame, direction });
    expect(at(0, 'next')).toBe(25);
    expect(at(25, 'next')).toBe(60);
    expect(at(60, 'previous')).toBe(25);
  });

  it('ignores the keyframes of another sequence', () => {
    expect(resolveSceneAdjacentKeyframeFrame({ tracks, parts: [], activeTemplateId: 'Other', partIds: [], frame: 0, direction: 'next' })).toBe(30);
    expect(resolveSceneAdjacentKeyframeFrame({ tracks, parts: [], activeTemplateId: 'Other', partIds: [], frame: 30, direction: 'next' })).toBeNull();
  });
});
