import { describe, it, expect } from 'vitest';
import { TOOLBAR_COLORS, DEFAULT_CLONER_CONFIG, DEFAULT_PARTICLE_CONFIG, PART_ANCHOR_OFFSETS, AUTOSAVE_STORAGE_KEY, DEFAULT_MOTION_TEMPLATES } from '../utils/constants';

describe('Constants Utility', () => {
  it('exports correctly structured configs', () => {
    expect(TOOLBAR_COLORS.length).toBeGreaterThan(0);
    expect(AUTOSAVE_STORAGE_KEY).toBe('SEQUENCER_STUDIO_PRO_V5');
    
    expect(DEFAULT_CLONER_CONFIG).toHaveProperty('countX');
    expect(DEFAULT_PARTICLE_CONFIG).toHaveProperty('count');
    
    expect(PART_ANCHOR_OFFSETS).toHaveProperty('top-left');
    expect(DEFAULT_MOTION_TEMPLATES[0].id).toBe('Sequence');
  });
});
