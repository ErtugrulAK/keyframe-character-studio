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
});
