/**
 * Undo snapshots share structure with the live scene: recording keeps the
 * state arrays, undo hands the recorded ones back, and an in-place edit of
 * recorded state throws in development instead of rewriting history.
 */
import { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { deepFreeze, structurallyEqual } from '../utils/persistence/historySnapshot';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

const renderProvider = () => {
  let live: AnimatorContextType | null = null;
  render(<AnimatorProvider><Consumer onCtx={(context) => { live = context; }} /></AnimatorProvider>);
  return () => live!;
};

describe('structurallyEqual', () => {
  it('compares by value and treats an undefined key as absent', () => {
    expect(structurallyEqual({ a: 1, b: [1, { c: 'x' }] }, { b: [1, { c: 'x' }], a: 1 })).toBe(true);
    expect(structurallyEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(structurallyEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(structurallyEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(structurallyEqual([1], { 0: 1 })).toBe(false);
    expect(structurallyEqual({ a: null }, { a: {} })).toBe(false);
  });

  it('does not walk a shared subtree', () => {
    let reads = 0;
    const shared = new Proxy({ x: 1 }, { ownKeys: (target) => { reads += 1; return Reflect.ownKeys(target); } });
    expect(structurallyEqual({ shared, y: 1 }, { shared, y: 2 })).toBe(false);
    expect(structurallyEqual({ shared, y: 1 }, { shared, y: 1 })).toBe(true);
    expect(reads).toBe(0);
  });
});

describe('deepFreeze', () => {
  it('freezes nested objects and arrays, leaving binary views alone', () => {
    const bytes = new Uint8Array([1, 2]);
    const value = deepFreeze({ list: [{ x: 1 }], bytes });
    expect(Object.isFrozen(value.list)).toBe(true);
    expect(Object.isFrozen(value.list[0])).toBe(true);
    expect(() => { (value.list[0] as { x: number }).x = 2; }).toThrow(TypeError);
    expect(Object.isFrozen(bytes)).toBe(false);
  });
});

describe('history structural sharing', () => {
  afterEach(() => cleanup());

  it('restores the recorded arrays on undo and redo, without copying them', () => {
    const ctx = renderProvider();
    act(() => { ctx().addCustomPart('custom_rect', 'First'); });
    const afterFirst = { parts: ctx().characterParts, tracks: ctx().tracks };
    act(() => { ctx().addCustomPart('custom_circle', 'Second'); });
    const afterSecond = { parts: ctx().characterParts, tracks: ctx().tracks };

    act(() => { ctx().undo(); });
    expect(ctx().characterParts).toBe(afterFirst.parts);
    expect(ctx().tracks).toBe(afterFirst.tracks);

    act(() => { ctx().redo(); });
    expect(ctx().characterParts).toBe(afterSecond.parts);
    expect(ctx().tracks).toBe(afterSecond.tracks);
  });

  it('records a value-equal replacement as no change', () => {
    const ctx = renderProvider();
    act(() => { ctx().addCustomPart('custom_rect', 'Only'); });
    expect(ctx().canUndo).toBe(true);
    act(() => { ctx().undo(); });
    expect(ctx().canUndo).toBe(false);
    act(() => { ctx().redo(); });
    act(() => { ctx().setCharacterParts((parts) => parts.map((part) => ({ ...part }))); });
    act(() => { ctx().undo(); });
    // One undo goes back past the add: the copy did not become its own step.
    expect(ctx().characterParts.some((part) => part.name === 'Only')).toBe(false);
  });

  it('throws on an in-place edit of recorded scene state in development', () => {
    const ctx = renderProvider();
    act(() => { ctx().addCustomPart('custom_rect', 'Recorded'); });
    const part = ctx().characterParts.find((candidate) => candidate.name === 'Recorded')!;
    expect(() => { (part as { x: number }).x = 99; }).toThrow(TypeError);
    expect(() => { (ctx().characterParts as unknown[]).push({}); }).toThrow(TypeError);
  });
});
