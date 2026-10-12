import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSelection } from '../hooks/useSelection';

describe('useSelection Hook', () => {
  it('initializes with null selection state', () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.selectedPartId).toBeNull();
    expect(result.current.selectedPartIds).toEqual([]);
    expect(result.current.focusModeNodeId).toBeNull();
  });

  it('selects a single part', () => {
    const { result } = renderHook(() => useSelection());
    
    act(() => {
      result.current.handleSelectPart('part_1', false);
    });

    expect(result.current.selectedPartId).toBe('part_1');
    expect(result.current.selectedPartIds).toEqual(['part_1']);
  });

  it('toggles selection in multi-select mode', () => {
    const { result } = renderHook(() => useSelection());
    
    act(() => {
      result.current.handleSelectPart('part_1', true);
    });
    expect(result.current.selectedPartIds).toEqual(['part_1']);

    act(() => {
      result.current.handleSelectPart('part_2', true);
    });
    expect(result.current.selectedPartIds).toEqual(['part_1', 'part_2']);
    
    // Toggle part_1 off
    act(() => {
      result.current.handleSelectPart('part_1', true);
    });
    expect(result.current.selectedPartIds).toEqual(['part_2']);
    expect(result.current.selectedPartId).toBe('part_2'); // Primary selection falls back to the remaining
  });

  it('clears selection when null is passed', () => {
    const { result } = renderHook(() => useSelection());
    
    act(() => {
      result.current.handleSelectPart('part_1');
      result.current.handleSelectPart(null);
    });

    expect(result.current.selectedPartId).toBeNull();
    expect(result.current.selectedPartIds).toEqual([]);
  });

  it('tracks transient Boolean operand editing and clears it on deselection', () => {
    const { result } = renderHook(() => useSelection());

    act(() => result.current.setBooleanOperandEditingGroupId('group'));
    expect(result.current.booleanOperandEditingGroupId).toBe('group');

    act(() => result.current.handleSelectPart(null));
    expect(result.current.booleanOperandEditingGroupId).toBeNull();
  });

  describe('keyframe selection', () => {
    it('keeps one canonical set where a single key is a one-member selection', () => {
      const { result } = renderHook(() => useSelection());
      expect(result.current.selectedKeyframeIds).toEqual([]);
      expect(result.current.selectedKeyframeId).toBeNull();

      act(() => result.current.setSelectedKeyframeId('k2'));
      expect(result.current.selectedKeyframeIds).toEqual(['k2']);
      expect(result.current.selectedKeyframeId).toBe('k2');

      act(() => result.current.setSelectedKeyframeId(null));
      expect(result.current.selectedKeyframeIds).toEqual([]);
      expect(result.current.selectedKeyframeId).toBeNull();
    });

    it('replaces the whole selection with a marquee result and dedupes it', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setSelectedKeyframeId('k1'));

      act(() => result.current.selectKeyframes(['k3', 'k4', 'k3'], 'replace'));

      expect(result.current.selectedKeyframeIds).toEqual(['k3', 'k4']);
      // The primary key is the last one added: the key the single-key
      // authorities (curve editor, delete, copy) operate on.
      expect(result.current.selectedKeyframeId).toBe('k4');
    });

    it('toggles keys into and out of the selection without disturbing the rest', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectKeyframes(['k1', 'k2'], 'replace'));

      act(() => result.current.selectKeyframes(['k3'], 'toggle'));
      expect(result.current.selectedKeyframeIds).toEqual(['k1', 'k2', 'k3']);

      act(() => result.current.selectKeyframes(['k2'], 'toggle'));
      expect(result.current.selectedKeyframeIds).toEqual(['k1', 'k3']);
      expect(result.current.selectedKeyframeId).toBe('k3');

      // Removing the last key leaves an empty selection, not a stale primary.
      act(() => result.current.selectKeyframes(['k1', 'k3'], 'toggle'));
      expect(result.current.selectedKeyframeIds).toEqual([]);
      expect(result.current.selectedKeyframeId).toBeNull();
    });

    it('folds a Shift-marquee addition into the selection it grew from', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectKeyframes(['k1'], 'replace'));

      // The marquee captured ['k1'] at pointerdown and reports the live union.
      act(() => result.current.selectKeyframes(['k1', 'k5', 'k6'], 'replace'));
      expect(result.current.selectedKeyframeIds).toEqual(['k1', 'k5', 'k6']);
      expect(result.current.selectedKeyframeId).toBe('k6');
    });
  });
});
