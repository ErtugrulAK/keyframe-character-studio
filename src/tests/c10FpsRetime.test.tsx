import { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { retimeDocumentForFps, type FpsRetimeDocument } from '../utils/fpsRetime';
import type { CharacterPart, PropertyKeyframe, Track } from '../types/animator';

const key = (id: string, frame: number, value: number, templateId = 'Sequence'): PropertyKeyframe => ({ id, frame, value, easing: 'easeInOut', templateId });

const doc = (): FpsRetimeDocument => ({
  tracks: [{
    id: 't', partId: 'p', name: 'p', color: '#fff', visible: true, locked: false, expanded: false,
    keyframes: [{ id: 'legacy', frame: 30, templateId: 'Sequence', transform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }],
    channels: { x: [key('x0', 0, 0), key('x30', 30, 100), key('x60', 60, 200)] } as unknown as Track['channels'],
    maskChannels: { 'm1:feather': [key('f15', 15, 4)] } as unknown as Track['maskChannels'],
  } as unknown as Track],
  characterParts: [{ id: 'p', name: 'p', inAnimPreset: 'fade', inAnimDuration: 20, outAnimDuration: 10, textAnimStartFrame: 6 } as unknown as CharacterPart],
  motionTemplates: [{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60 }],
  totalFrames: 60,
  currentFrame: 45,
});

describe('C10 retimeDocumentForFps — the frame rate keeps time', () => {
  it('30 → 60 fps doubles every frame number and leaves values, easing and IDs alone', () => {
    const out = retimeDocumentForFps(doc(), 30, 60);
    expect(out.tracks[0].channels.x.map((k) => [k.id, k.frame, k.value, k.easing])).toEqual([
      ['x0', 0, 0, 'easeInOut'], ['x30', 60, 100, 'easeInOut'], ['x60', 120, 200, 'easeInOut'],
    ]);
    expect(out.tracks[0].maskChannels!['m1:feather' as never][0].frame).toBe(30);
    expect(out.tracks[0].keyframes![0].frame).toBe(60);
    expect(out.motionTemplates[0].durationFrames).toBe(120);
    expect(out.totalFrames).toBe(120);
    expect(out.currentFrame).toBe(90);
    expect(out.characterParts[0]).toMatchObject({ inAnimDuration: 40, outAnimDuration: 20, textAnimStartFrame: 12 });
    expect(out.mergedKeys).toBe(0);
  });

  it('a lower rate merges keys of one property that land on one frame, keeping the later key', () => {
    const input = doc();
    input.tracks[0].channels.x = [key('a', 10, 1), key('b', 11, 2), key('c', 40, 3)] as never;
    const out = retimeDocumentForFps(input, 60, 24);
    // 10 → 4, 11 → 4.4 → 4 (collision, b wins), 40 → 16.
    expect(out.tracks[0].channels.x.map((k) => [k.id, k.frame])).toEqual([['b', 4], ['c', 16]]);
    expect(out.mergedKeys).toBe(1);
  });

  it('keys of different sequences never merge, and the same rate is a no-op', () => {
    const input = doc();
    input.tracks[0].channels.x = [key('a', 10, 1), key('b', 10, 2, 'Out')] as never;
    expect(retimeDocumentForFps(input, 30, 15).tracks[0].channels.x.map((k) => k.id)).toEqual(['a', 'b']);
    expect(retimeDocumentForFps(input, 30, 30).tracks).toBe(input.tracks);
  });
});

describe('C10 changeFps — one undo step', () => {
  afterEach(() => cleanup());

  it('rescales the document with the rate, and one undo restores both', () => {
    let live: AnimatorContextType | null = null;
    const Consumer = () => {
      const ctx = useAnimator();
      useEffect(() => { live = ctx; });
      return null;
    };
    render(<AnimatorProvider><Consumer /></AnimatorProvider>);
    const ctx = () => live!;
    act(() => { ctx().addCustomPart('custom_rect', 'Box'); });
    const part = ctx().characterParts.find((candidate) => candidate.name === 'Box')!;
    const trackId = ctx().tracks.find((track) => track.partId === part.id)!.id;
    act(() => { ctx().setCurrentFrame(20); });
    act(() => { ctx().addPropertyKeyframe(trackId, 'x', 20, 50); });
    const before = { fps: ctx().fps, totalFrames: ctx().totalFrames };
    const keyFrames = () => ctx().tracks.find((track) => track.id === trackId)!.channels.x.map((k) => k.frame);
    expect(keyFrames()).toEqual([20]);

    const target = before.fps === 30 ? 60 : 30;
    act(() => { ctx().changeFps(target); });
    expect(ctx().fps).toBe(target);
    expect(keyFrames()).toEqual([Math.round(20 * target / before.fps)]);
    expect(ctx().totalFrames).toBe(Math.max(1, Math.round(before.totalFrames * target / before.fps)));

    act(() => { ctx().undo(); });
    expect(ctx().fps).toBe(before.fps);
    expect(keyFrames()).toEqual([20]);
    expect(ctx().totalFrames).toBe(before.totalFrames);
  });
});
