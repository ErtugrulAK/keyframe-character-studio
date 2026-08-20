import { describe, it, expect } from 'vitest';
import { createCustomPart } from '../utils/partFactory';

describe('PartFactory Utility', () => {
  it('creates a standard part and track', () => {
    const { newPart, newTrack } = createCustomPart('head', 'My Head', 5);
    
    expect(newPart.id).toBeDefined();
    expect(newPart.name).toBe('My Head');
    expect(newPart.type).toBe('head');
    expect(newPart.zIndex).toBe(5);
    expect(newPart.baseTransform.opacity).toBe(1);
    
    expect(newTrack.partId).toBe(newPart.id);
    expect(newTrack.name).toBe('My Head');
    expect(newTrack.channels).toBeDefined();
    expect(newTrack.keyframes.length).toBe(0);
  });

  it('creates custom configurations for specific types', () => {
    const textRes = createCustomPart('custom_text', 'Text Layer', 1);
    expect(textRes.newPart.textValue).toBe('NEW TEXT');

    const mographRes = createCustomPart('mograph_cloner', 'Cloner', 2);
    expect(mographRes.newPart.clonerConfig).toBeDefined();
    expect(mographRes.newPart.clonerConfig?.countX).toBeDefined();

    const particleRes = createCustomPart('particle_system', 'Particles', 3);
    expect(particleRes.newPart.particleConfig).toBeDefined();
  });

  it('applies extra props safely', () => {
    const { newPart } = createCustomPart('body', 'Body', 1, { parentId: 'parent_123', strokeProgress: 0.5 });
    expect(newPart.parentId).toBe('parent_123');
    expect(newPart.strokeProgress).toBe(0.5);
  });
});
