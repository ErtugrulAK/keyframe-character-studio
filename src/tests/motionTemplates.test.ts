import { describe, expect, it } from 'vitest';
import type { MotionTemplate } from '../types/animator';
import {
  createMotionTemplate,
  normalizeMotionTemplates,
} from '../utils/animation/motionTemplates';

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

});
