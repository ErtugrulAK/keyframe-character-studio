import { describe, it, expect } from 'vitest';
import { tickLiveStuntsState, tickBroadcastState } from '../utils/broadcastEngine';
import { BroadcastObjectState } from '../types/animator';

describe('BroadcastEngine Utility', () => {
  it('ticks live stunts progress correctly', () => {
    const prev = {
      'part_1': { stunt: 'spin' as const, progress: 0.5, loop: true }
    };
    
    // dtMs = 400ms, default stunt is 800ms. Delta should be 0.5.
    // 0.5 + 0.5 = 1.0 -> loop -> 0.0
    const next = tickLiveStuntsState(prev, 400, [], 30);
    expect(next['part_1'].progress).toBe(0);
    expect(next['part_1'].stunt).toBe('spin');
  });

  it('deletes finished single-shot stunts', () => {
    const prev = {
      'part_1': { stunt: 'pulse' as const, progress: 0.8, loop: false }
    };
    
    // 400ms delta -> +0.5 progress -> 1.3 -> finished.
    const next = tickLiveStuntsState(prev, 400, [], 30);
    expect(next['part_1']).toBeUndefined();
  });

  it('ticks broadcast state to visible', () => {
    const prev: Record<string, BroadcastObjectState> = {
      'part_1': { state: 'animating_in', progress: 0.5 }
    };

    const parts = [
      { id: 'part_1', type: 'head' as const, name: 'Test', zIndex: 1, baseTransform: { x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 }, inAnimDuration: 30 }
    ];

    // 30 frames at 30 fps = 1000ms.
    // dtMs = 600ms -> +0.6 progress -> 1.1 -> caps at 1, changes state to visible.
    const next = tickBroadcastState(prev, 600, parts, [], 30);
    expect(next['part_1'].progress).toBe(1);
    expect(next['part_1'].state).toBe('visible');
  });
});
