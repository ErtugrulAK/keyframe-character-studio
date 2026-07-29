import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMath } from '../hooks/useMath';
import { Track, CharacterPart, Transform } from '../types/animator';

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
});
