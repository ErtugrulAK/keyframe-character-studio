import { describe, it, expect } from 'vitest';
import { generateTransitionKeyframes } from '../utils/motionTransitions';
import { Transform } from '../types/animator';

describe('MotionTransitions Utility', () => {
  const baseTransform: Transform = { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  it('returns null for "none" transition', () => {
    const result = generateTransitionKeyframes(baseTransform, 'none', 0, 15);
    expect(result).toBeNull();
  });

  it('generates accurate move_left keyframes', () => {
    const result = generateTransitionKeyframes(baseTransform, 'move_left', 10, 25);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.kfStart.frame).toBe(10);
      expect(result.kfEnd.frame).toBe(25);
      
      expect(result.kfStart.transform.x).toBe(350); // 100 + 250
      expect(result.kfStart.transform.opacity).toBe(0);
      expect(result.kfEnd.transform.opacity).toBe(1);
    }
  });

  it('generates accurate bounce keyframes with custom easing', () => {
    const result = generateTransitionKeyframes(baseTransform, 'bounce', 0, 15);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.kfStart.transform.y).toBe(-80); // 100 - 180
      expect(result.kfStart.easing).toBe('bounce');
    }
  });
});
