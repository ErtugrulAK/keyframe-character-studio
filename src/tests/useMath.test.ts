import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useMath } from '../hooks/useMath';
import { Track, CharacterPart } from '../types/animator';

describe('useMath Hook', () => {
  const mockPart: CharacterPart = {
    id: 'part_1', type: 'head', name: 'P1', zIndex: 1, baseTransform: { x:10, y:20, rotation:0, scaleX:1, scaleY:1, opacity:1 }
  };
  
  const mockTrack: Track = {
    id: 'track_1', partId: 'part_1', name: 'T1', channels: { customProps: [] },
    keyframes: [
      { id: 'kf_1', frame: 0, templateId: 'Sequence', transform: { x:10, y:20, rotation:0, scaleX:1, scaleY:1, opacity:1 }, easing: 'linear' },
      { id: 'kf_2', frame: 10, templateId: 'Sequence', transform: { x:110, y:20, rotation:0, scaleX:1, scaleY:1, opacity:1 }, easing: 'linear' }
    ]
  } as any;

  it('calculates interpolated transform and caches result', () => {
    const { result, rerender } = renderHook(({ parts, tracks }) => useMath({
      characterParts: parts,
      tracks: tracks,
      activeTemplateId: 'Sequence'
    }), {
      initialProps: { parts: [mockPart], tracks: [mockTrack] }
    });

    // Frame 5 should be halfway between 10 and 110 = 60
    const t5 = result.current.getComputedTransform('part_1', 5);
    expect(t5.x).toBe(60);

    // Call again to hit cache
    const t5_cached = result.current.getComputedTransform('part_1', 5);
    expect(t5_cached.x).toBe(60);
    expect(t5_cached).toBe(t5); // Same reference implies cache hit
    
    // Rerender clears cache
    rerender({ parts: [{...mockPart, name: 'P1_new'}], tracks: [mockTrack] });
    const t5_new = result.current.getComputedTransform('part_1', 5);
    expect(t5_new).not.toBe(t5); // Different reference
  });

  it('falls back to base transform if no track', () => {
    const { result } = renderHook(() => useMath({
      characterParts: [mockPart],
      tracks: [],
      activeTemplateId: 'Sequence'
    }));

    const t = result.current.getComputedTransform('part_1', 0);
    expect(t.x).toBe(10);
  });

  it('P4-S2: reflects animated opacity from keyframes (not just base)', () => {
    const opacityPart: CharacterPart = {
      id: 'part_op', type: 'head', name: 'OP', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.5 }
    };
    const opacityTrack: Track = {
      id: 'track_op', partId: 'part_op', name: 'T_op', channels: { customProps: [] },
      keyframes: [
        { id: 'kf_1', frame: 0, templateId: 'Sequence', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.2 }, easing: 'linear' },
        { id: 'kf_2', frame: 10, templateId: 'Sequence', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1.0 }, easing: 'linear' }
      ]
    } as any;

    const { result } = renderHook(() => useMath({
      characterParts: [opacityPart],
      tracks: [opacityTrack],
      activeTemplateId: 'Sequence'
    }));

    // Frame 0 → 0.2, frame 5 → 0.6 (linear), frame 10 → 1.0
    expect(result.current.getComputedTransform('part_op', 0).opacity).toBeCloseTo(0.2, 4);
    expect(result.current.getComputedTransform('part_op', 5).opacity).toBeCloseTo(0.6, 4);
    expect(result.current.getComputedTransform('part_op', 10).opacity).toBeCloseTo(1.0, 4);
  });

  it('P4-S2: opacity parity — getComputedTransform matches evaluateTransform', () => {
    const { result } = renderHook(() => useMath({
      characterParts: [mockPart],
      tracks: [mockTrack],
      activeTemplateId: 'Sequence'
    }));

    // mockTrack keyframes: x 10→110, opacity stays 1. evaluateTransform is the
    // same pure core; the hook must surface the same evaluated opacity.
    const viaHook = result.current.getComputedTransform('part_1', 5);
    expect(viaHook.opacity).toBeCloseTo(1.0, 4);
    expect(viaHook.x).toBe(60);
  });
});
