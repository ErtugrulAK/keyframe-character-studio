import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useModifierEditing } from '../hooks/useModifierEditing';
import type { CharacterPart, Track } from '../types/animator';

/**
 * A modifier edit is one undoable write: the patch lands on its layer, a field
 * set to `undefined` removes that modifier, and tracks are written only when
 * keeping the picture still actually changed them.
 */
const part = (id: string, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  width: 100,
  height: 40,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...extra,
} as CharacterPart);

const setup = (parts: CharacterPart[], tracks: Track[] = []) => {
  const calls: string[] = [];
  const deps = {
    characterParts: parts,
    tracks,
    setCharacterParts: vi.fn(() => calls.push('parts')),
    setTracks: vi.fn(() => calls.push('tracks')),
    startBatchInteraction: vi.fn(() => calls.push('start')),
    endBatchInteraction: vi.fn(() => calls.push('end')),
  };
  const { result } = renderHook(() => useModifierEditing(deps));
  return { edit: result.current, deps, calls };
};

const written = (deps: ReturnType<typeof setup>['deps']) => deps.setCharacterParts.mock.calls[0][0] as unknown as CharacterPart[];

describe('useModifierEditing', () => {
  it('writes the patch on its layer only, inside one batch', () => {
    const other = part('b');
    const { edit, deps, calls } = setup([part('a'), other]);
    edit('a', { justify: { mode: 'center' } as CharacterPart['justify'] });
    expect(calls[0]).toBe('start');
    expect(calls[calls.length - 1]).toBe('end');
    const parts = written(deps);
    expect(parts.find((p) => p.id === 'a')!.justify).toEqual({ mode: 'center' });
    expect(parts.find((p) => p.id === 'b')).toBe(other);
  });

  it('a field set to undefined removes that modifier instead of storing undefined', () => {
    const { edit, deps } = setup([part('a', { lookAt: { targetId: 'b' } as CharacterPart['lookAt'] }), part('b')]);
    edit('a', { lookAt: undefined });
    const parts = written(deps);
    expect('lookAt' in parts.find((p) => p.id === 'a')!).toBe(false);
  });

  it('does not write tracks when keeping the picture still left them unchanged', () => {
    const { edit, deps } = setup([part('a')]);
    edit('a', { justify: undefined });
    expect(deps.setTracks).not.toHaveBeenCalled();
  });
});
