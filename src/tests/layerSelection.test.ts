import { describe, expect, it, vi } from 'vitest';
import { selectAllLayers } from '../utils/layers/layerSelection';

describe('selectAllLayers', () => {
  it('selects every layer and makes the last one primary', () => {
    const setSelectedPartIds = vi.fn();
    const setSelectedPartId = vi.fn();
    const ids = selectAllLayers([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { setSelectedPartIds, setSelectedPartId });
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(setSelectedPartIds).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(setSelectedPartId).toHaveBeenCalledWith('c');
  });

  it('leaves locked layers out, and the primary is the last unlocked one', () => {
    const setSelectedPartIds = vi.fn();
    const setSelectedPartId = vi.fn();
    selectAllLayers([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { setSelectedPartIds, setSelectedPartId }, new Set(['c']));
    expect(setSelectedPartIds).toHaveBeenCalledWith(['a', 'b']);
    expect(setSelectedPartId).toHaveBeenCalledWith('b');
  });

  it('clears the primary when nothing can be selected', () => {
    const setSelectedPartIds = vi.fn();
    const setSelectedPartId = vi.fn();
    selectAllLayers([{ id: 'a' }], { setSelectedPartIds, setSelectedPartId }, new Set(['a']));
    expect(setSelectedPartIds).toHaveBeenCalledWith([]);
    expect(setSelectedPartId).toHaveBeenCalledWith(null);
  });
});
