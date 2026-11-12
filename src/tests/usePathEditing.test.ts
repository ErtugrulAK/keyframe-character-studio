import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { usePathEditing } from '../hooks/usePathEditing';
import type { BezierPath, CharacterPart, Track } from '../types/animator';

/**
 * Editable path layers: the point selection the canvas and the Inspector
 * share, Delete on a selected point, and writing a path back to the layer.
 */
const pathOf = (count: number, closed: boolean): BezierPath => ({
  version: 1,
  coordinateSpace: 'local',
  closed,
  points: Array.from({ length: count }, (_, index) => ({ id: `v${index}`, x: index * 10, y: index % 2 ? 10 : 0, kind: 'corner' as const })),
} as unknown as BezierPath);

const freeform = (id: string, path: BezierPath): CharacterPart => ({
  id,
  name: id,
  type: 'custom_freeform',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  path,
  points: path.points.map(({ x, y }) => ({ x, y })),
} as unknown as CharacterPart);

const setup = (parts: CharacterPart[], initialSelected: string | null = parts[0]?.id ?? null) => {
  const showToast = vi.fn();
  const hook = renderHook(() => {
    const [characterParts, setCharacterParts] = useState(parts);
    const [selectedPartId, setSelectedPartId] = useState<string | null>(initialSelected);
    const editing = usePathEditing({ characterParts, tracks: [] as Track[], setCharacterParts, selectedPartId, showToast });
    return { ...editing, characterParts, setSelectedPartId };
  });
  return { ...hook, showToast };
};

const pathOfPart = (parts: CharacterPart[], id: string) => (parts.find((p) => p.id === id) as CharacterPart & { path: BezierPath }).path;

describe('usePathEditing', () => {
  it('Delete removes the selected point, keeps the legacy anchor list in step and clears the selection', () => {
    const { result } = setup([freeform('p', pathOf(4, true))]);
    act(() => result.current.selectPathVertex('p', 1));
    let used = false;
    act(() => { used = result.current.deleteSelectedPathVertex(); });
    expect(used).toBe(true);
    const path = pathOfPart(result.current.characterParts, 'p');
    expect(path.points.map((v) => v.id)).toEqual(['v0', 'v2', 'v3']);
    expect((result.current.characterParts[0] as CharacterPart & { points: unknown[] }).points).toHaveLength(3);
    expect(result.current.pathVertex).toBeNull();
  });

  it('a closed path at three points keeps them and says why', () => {
    const { result, showToast } = setup([freeform('p', pathOf(3, true))]);
    act(() => result.current.selectPathVertex('p', 0));
    act(() => { result.current.deleteSelectedPathVertex(); });
    expect(pathOfPart(result.current.characterParts, 'p').points).toHaveLength(3);
    expect(showToast).toHaveBeenCalledWith('A closed path keeps at least three points.', 'info');
  });

  it('an open path at two points keeps them and names its own minimum', () => {
    const { result, showToast } = setup([freeform('p', pathOf(2, false))]);
    act(() => result.current.selectPathVertex('p', 0));
    act(() => { result.current.deleteSelectedPathVertex(); });
    expect(pathOfPart(result.current.characterParts, 'p').points).toHaveLength(2);
    expect(showToast).toHaveBeenCalledWith('An open path keeps at least two points.', 'info');
  });

  it('an open path above its minimum loses the point', () => {
    const { result } = setup([freeform('p', pathOf(3, false))]);
    act(() => result.current.selectPathVertex('p', 2));
    act(() => { result.current.deleteSelectedPathVertex(); });
    expect(pathOfPart(result.current.characterParts, 'p').points.map((v) => v.id)).toEqual(['v0', 'v1']);
  });

  it('Delete without a selected point is not used for the path', () => {
    const { result } = setup([freeform('p', pathOf(4, true))]);
    let used = true;
    act(() => { used = result.current.deleteSelectedPathVertex(); });
    expect(used).toBe(false);
  });

  it('selecting another layer clears the point selection', () => {
    const { result } = setup([freeform('p', pathOf(4, true)), freeform('q', pathOf(4, true))]);
    act(() => result.current.selectPathVertex('p', 1));
    expect(result.current.pathVertex).toEqual({ partId: 'p', index: 1 });
    act(() => result.current.setSelectedPartId('q'));
    expect(result.current.pathVertex).toBeNull();
  });

  it('setPartPath writes only a path layer', () => {
    const rect = { ...freeform('r', pathOf(3, true)), type: 'custom_rect' } as CharacterPart;
    const { result } = setup([freeform('p', pathOf(3, true)), rect]);
    act(() => result.current.setPartPath('p', pathOf(5, true)));
    act(() => result.current.setPartPath('r', pathOf(5, true)));
    expect(pathOfPart(result.current.characterParts, 'p').points).toHaveLength(5);
    expect(pathOfPart(result.current.characterParts, 'r').points).toHaveLength(3);
  });

  it('converting an unknown layer does nothing', () => {
    const { result, showToast } = setup([freeform('p', pathOf(3, true))]);
    let converted = true;
    act(() => { converted = result.current.convertToEditablePath('missing'); });
    expect(converted).toBe(false);
    expect(showToast).not.toHaveBeenCalled();
  });
});
