import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useClipboard } from '../hooks/useClipboard';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/animation/defaults';

/**
 * Duplicate (Ctrl+D) of a layer group follows the same reference rule as
 * Paste: every link into the duplicated set points at its copy. It used to
 * re-point only the parent, so a duplicated lower third's bar kept fitting
 * the ORIGINAL text and its matte kept the original source.
 */
const base = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const part = (id: string, extra: Partial<CharacterPart> = {}): CharacterPart =>
  ({ id, name: id, type: 'custom_rect', zIndex: 1, baseTransform: base, ...extra } as CharacterPart);
const track = (partId: string): Track => ({ id: `t-${partId}`, partId, name: partId, keyframes: [], channels: makeEmptyChannels() } as unknown as Track);

const scene = () => {
  const outside = part('outside');
  const group = part('group', { isGroup: true });
  const text = part('text', { type: 'custom_text', parentId: 'group' });
  const bar = part('bar', {
    parentId: 'group',
    fitToText: { textLayerId: 'text' } as CharacterPart['fitToText'],
    matte: { sourcePartId: 'text' } as CharacterPart['matte'],
    follow: { targetLayerId: 'outside' } as CharacterPart['follow'],
  });
  const parts = [outside, group, text, bar];
  return { parts, tracks: parts.map((p) => track(p.id)) };
};

const duplicate = (selectedPartId: string) => {
  const { parts, tracks } = scene();
  const setCharacterParts = vi.fn();
  const { result } = renderHook(() => useClipboard({
    characterParts: parts,
    tracks,
    selectedPartId,
    showToast: vi.fn(),
    setTracks: vi.fn(),
    setCharacterParts,
    setSelectedPartId: vi.fn(),
  }));
  act(() => result.current.duplicateSelectedPart());
  const after = setCharacterParts.mock.calls[0][0](parts) as CharacterPart[];
  const copies = after.slice(0, after.length - parts.length);
  const copyOf = (name: string) => copies.find((p) => p.name === `${name} Copy`)!;
  return { copies, copyOf };
};

describe('Duplicate of a group', () => {
  it('points the copied bar at the copied text, inside the copied group', () => {
    const { copyOf } = duplicate('group');
    const bar = copyOf('bar');
    const text = copyOf('text');
    const group = copyOf('group');
    expect(bar.parentId).toBe(group.id);
    expect(text.parentId).toBe(group.id);
    expect(bar.fitToText?.textLayerId).toBe(text.id);
    expect(bar.matte?.sourcePartId).toBe(text.id);
  });

  it('keeps a link to a layer outside the duplicated set', () => {
    const { copyOf } = duplicate('group');
    expect(copyOf('bar').follow?.targetLayerId).toBe('outside');
  });

  it('a single duplicated layer keeps its group and its links', () => {
    const { copies } = duplicate('bar');
    expect(copies).toHaveLength(1);
    expect(copies[0].parentId).toBe('group');
    expect(copies[0].fitToText?.textLayerId).toBe('text');
  });
});

describe('Duplicate keeps the stacking order', () => {
  /**
   * QA 2026-11-13: a duplicated lower third showed its text BEHIND its bar.
   * The copies were numbered in the group's walk order instead of their
   * stacking order, so a text listed before its bar but drawn above it
   * came out drawn below it. Paste already ranks by stacking order.
   */
  const stackedScene = () => {
    const group = part('group', { isGroup: true, zIndex: 1 });
    const text = part('text', { type: 'custom_text', parentId: 'group', zIndex: 3 });
    const bar = part('bar', { parentId: 'group', zIndex: 2 });
    return [group, text, bar];
  };

  const duplicateStacked = () => {
    const parts = stackedScene();
    const setCharacterParts = vi.fn();
    const { result } = renderHook(() => useClipboard({
      characterParts: parts,
      tracks: parts.map((p) => track(p.id)),
      selectedPartId: 'group',
      showToast: vi.fn(),
      setTracks: vi.fn(),
      setCharacterParts,
      setSelectedPartId: vi.fn(),
    }));
    act(() => result.current.duplicateSelectedPart());
    const after = setCharacterParts.mock.calls[0][0](parts) as CharacterPart[];
    const z = (name: string) => after.find((p) => p.name === name)!.zIndex ?? 0;
    return { z, originals: parts };
  };

  it('draws the copied text above the copied bar, as the original is', () => {
    const { z } = duplicateStacked();
    expect(z('text Copy')).toBeGreaterThan(z('bar Copy'));
    expect(z('bar Copy')).toBeGreaterThan(z('group Copy'));
  });

  it('places every copy above every original', () => {
    const { z, originals } = duplicateStacked();
    const highestOriginal = Math.max(...originals.map((p) => p.zIndex ?? 0));
    for (const name of ['group Copy', 'text Copy', 'bar Copy']) expect(z(name)).toBeGreaterThan(highestOriginal);
  });
});
