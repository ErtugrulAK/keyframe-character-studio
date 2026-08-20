import { describe, it, expect } from 'vitest';
import {
  createIdleNamedSequenceRuntime,
  startNamedSequence,
  tickBroadcastState,
  tickLiveStuntsState,
  tickNamedSequenceRuntime,
} from '../utils/broadcastEngine';
import type { BroadcastObjectState } from '../types/animator';

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

  describe('named sequence runtime contract', () => {
    it('starts idle and starts a sequence at frame 0 in playing state', () => {
      expect(createIdleNamedSequenceRuntime()).toEqual({
        sequenceId: null,
        status: 'idle',
        frame: 0,
        durationFrames: 0,
      });

      expect(startNamedSequence('sequence-1', 60)).toEqual({
        sequenceId: 'sequence-1',
        status: 'playing',
        frame: 0,
        durationFrames: 60,
      });
    });

    it('advances deterministically from dtMs and FPS', () => {
      const started = startNamedSequence('sequence-1', 60);
      const at30Fps = tickNamedSequenceRuntime(started, 500, 30);
      const at60Fps = tickNamedSequenceRuntime(started, 500, 60);

      expect(at30Fps.frame).toBe(15);
      expect(at60Fps.frame).toBe(30);
      expect(at30Fps.status).toBe('playing');
      expect(tickNamedSequenceRuntime(at30Fps, 250, 30).frame).toBe(22.5);
    });

    it('clamps at duration, transitions to holding, and retains the final frame', () => {
      const started = startNamedSequence('sequence-1', 24);
      const completed = tickNamedSequenceRuntime(started, 2000, 24);

      expect(completed).toEqual({
        sequenceId: 'sequence-1',
        status: 'holding',
        frame: 24,
        durationFrames: 24,
      });
      expect(tickNamedSequenceRuntime(completed, 1000, 24)).toBe(completed);
    });

    it('replays the same sequence from frame 0', () => {
      const completed = tickNamedSequenceRuntime(startNamedSequence('sequence-1', 30), 1000, 30);
      expect(completed.status).toBe('holding');

      expect(startNamedSequence(completed.sequenceId!, completed.durationFrames)).toEqual({
        sequenceId: 'sequence-1',
        status: 'playing',
        frame: 0,
        durationFrames: 30,
      });
    });

    it('interrupts with another sequence that starts at frame 0', () => {
      const first = tickNamedSequenceRuntime(startNamedSequence('sequence-1', 60), 500, 30);
      expect(first.frame).toBe(15);

      expect(startNamedSequence('sequence-2', 45)).toEqual({
        sequenceId: 'sequence-2',
        status: 'playing',
        frame: 0,
        durationFrames: 45,
      });
    });

    it.each(['IN', 'OUT', 'SPECIAL'])('gives %s no special engine semantics', (sequenceId) => {
      const state = tickNamedSequenceRuntime(startNamedSequence(sequenceId, 30), 500, 30);
      expect(state).toEqual({
        sequenceId,
        status: 'playing',
        frame: 15,
        durationFrames: 30,
      });
    });

    it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
      'normalizes invalid or edge duration %s to an immediate frame-0 hold',
      (durationFrames) => {
        expect(startNamedSequence('sequence-1', durationFrames)).toEqual({
          sequenceId: 'sequence-1',
          status: 'holding',
          frame: 0,
          durationFrames: 0,
        });
      },
    );

    it('normalizes fractional duration downward and ignores invalid tick inputs', () => {
      const started = startNamedSequence('sequence-1', 30.9);
      expect(started.durationFrames).toBe(30);
      expect(tickNamedSequenceRuntime(started, 500, 0)).toBe(started);
      expect(tickNamedSequenceRuntime(started, Number.NaN, 30)).toBe(started);
      expect(tickNamedSequenceRuntime(started, -1, 30)).toBe(started);
    });
  });
});
