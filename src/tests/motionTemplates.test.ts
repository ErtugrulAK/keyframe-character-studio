import { describe, expect, it } from 'vitest';
import type { MotionTemplate, Track } from '../types/animator';
import {
  cloneSequenceAnimation,
  createMotionTemplate,
  normalizeMotionTemplates,
} from '../utils/motionTemplates';

const templates: MotionTemplate[] = [
  { id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60 },
  { id: 'seq_source', name: 'IN', type: 'in', durationFrames: 30 },
];

describe('motion template metadata', () => {
  it('preserves valid historical IDs while normalizing missing metadata', () => {
    expect(normalizeMotionTemplates([
      { id: 'legacy-name', name: 'Legacy', type: 'out', durationFrames: 4 },
      { id: '', name: '', type: 'in', durationFrames: -3 },
    ])).toEqual([
      { id: 'legacy-name', name: 'Legacy', type: 'out', durationFrames: 4 },
      { id: 'Sequence 2', name: 'Sequence 2', type: 'in', durationFrames: 0 },
    ]);
  });

  it('creates a generated ID independent from display name', () => {
    const created = createMotionTemplate('IN', templates);
    expect(created.id).toMatch(/^seq_/);
    expect(created.id).not.toBe(created.name);
    expect(created.name).toBe('IN 2');
  });

  it('duplicates only the selected sequence and regenerates keyframe IDs', () => {
    const tracks = [{
      id: 'track_1', partId: 'part_1', name: 'Track', color: '#fff', visible: true, locked: false,
      channels: {
        x: [
          { id: 'source-x', frame: 0, value: 10, easing: 'linear', templateId: 'seq_source' },
          { id: 'other-x', frame: 0, value: 99, easing: 'linear', templateId: 'other' },
        ],
      },
      keyframes: [],
    }] as unknown as Track[];

    const duplicated = cloneSequenceAnimation(tracks, 'seq_source', 'seq_copy');
    expect(duplicated[0].channels.x).toHaveLength(3);
    expect(duplicated[0].channels.x.map((keyframe) => keyframe.templateId)).toEqual(['seq_source', 'other', 'seq_copy']);
    expect(duplicated[0].channels.x[2].id).not.toBe('source-x');
  });
});
