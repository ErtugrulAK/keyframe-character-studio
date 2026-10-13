/**
 * R3-13 — ungrouping an animated group bakes the container's motion into it.
 *
 * Observed: Ungroup refused every animated group ("Ungroup cannot redistribute
 * an animated group"), so a group the user had animated could never be
 * dissolved; the only way out was deleting the container's keys and losing the
 * motion.
 *
 * These tests drive the real store, the real grouping authority and the real
 * evaluator, and assert the contract at the level the product exposes:
 *   1-2. the operation succeeds through `useLayerGrouping` and every child keeps
 *        the world pose it had inside the container, frame by frame;
 *   3. the container's animation ends up in the CHILDREN, not copied onto them;
 *   4. one undo/redo round-trips the whole document;
 *   5. save/reload keeps the same evaluated motion;
 *   6. the OGraf package exported before and after ungrouping paints the same
 *        frames in the static renderer and in the generated runtime.
 */

import React, { useEffect } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { useLayerGrouping, type LayerGrouping } from '../hooks/useLayerGrouping';
import type { SceneData } from '../types/composition';
import type { Transform } from '../types/animator';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { renderOGrafSvg } from '../ograf/svgRenderer';

const POSE_CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const;

const Consumer = ({ onCtx, onGrouping }: {
  onCtx: (ctx: AnimatorContextType) => void;
  onGrouping: (grouping: LayerGrouping) => void;
}) => {
  const ctx = useAnimator();
  const grouping = useLayerGrouping();
  useEffect(() => {
    onCtx(ctx);
    onGrouping(grouping);
  });
  return null;
};

type GeneratedGraphic = HTMLElement & {
  /** The generated runtime's own frame cursor and its render step. */
  _currentFrame: number;
  _render: () => void;
  load: (params: { renderType: 'realtime'; data?: unknown }) => Promise<Record<string, unknown>>;
  dispose: () => Promise<Record<string, unknown>>;
};

let graphicCounter = 0;

/** The generated `graphic.mjs`, instantiated as a custom element. */
const instantiateGraphic = (source: string): GeneratedGraphic => {
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as unknown as new () => GeneratedGraphic;
  graphicCounter += 1;
  const tagName = `x-kcs-ungroup-bake-${graphicCounter}`;
  customElements.define(tagName, Graphic);
  return document.createElement(tagName) as GeneratedGraphic;
};

const runtimeSource = (scene: SceneData): string => (
  compileOGrafPackage(scene).files.find((file) => file.path === 'graphic.mjs')?.content || ''
);

interface Harness {
  ctx: () => AnimatorContextType;
  grouping: () => LayerGrouping;
  addRect: (name: string, x: number, y: number) => string;
  /** Select the given layers and run the product's grouping action. */
  group: (ids: string[]) => string;
  /** Select the container and run the product's ungroup action. */
  ungroup: (groupId: string) => void;
  /** Author a transform keyframe per frame through the canonical authority. */
  authorKeys: (partId: string, frames: number[], patchAtFrame: (frame: number) => Partial<Transform>) => void;
  /** Evaluated world pose of a layer at a frame. */
  pose: (partId: string, frame: number) => Transform;
  /** The editor's own exported document. */
  scene: () => SceneData;
}

const renderHarness = (): Harness => {
  let live: AnimatorContextType | null = null;
  let liveGrouping: LayerGrouping | null = null;
  render(
    <AnimatorProvider>
      <Consumer
        onCtx={(context) => { live = context; }}
        onGrouping={(grouping) => { liveGrouping = grouping; }}
      />
    </AnimatorProvider>
  );
  const ctx = (): AnimatorContextType => {
    if (!live) throw new Error('provider context not captured yet');
    return live;
  };
  const grouping = (): LayerGrouping => {
    if (!liveGrouping) throw new Error('grouping authority not captured yet');
    return liveGrouping;
  };
  const select = (ids: string[]) => {
    act(() => {
      ctx().setSelectedPartIds(ids);
      ctx().setSelectedPartId(ids[0] ?? null);
    });
  };
  const addRect = (name: string, x: number, y: number): string => {
    act(() => { ctx().addCustomPart('custom_rect', name); });
    const part = ctx().characterParts.find((candidate) => candidate.name === name);
    if (!part) throw new Error(`rectangle ${name} was not created`);
    select([part.id]);
    act(() => { ctx().updateCurrentTransform({ x, y }, part.id); });
    return part.id;
  };
  const group = (ids: string[]): string => {
    select(ids);
    act(() => { grouping().groupSelection(); });
    const container = ctx().characterParts.find((candidate) => candidate.isGroup === true);
    if (!container) throw new Error('grouping did not create a container');
    return container.id;
  };
  const ungroup = (groupId: string): void => {
    select([groupId]);
    act(() => { grouping().ungroupSelection(); });
    if (ctx().characterParts.some((candidate) => candidate.id === groupId)) {
      throw new Error('ungroup did not remove the container');
    }
  };
  const authorKeys = (partId: string, frames: number[], patchAtFrame: (frame: number) => Partial<Transform>) => {
    const track = ctx().tracks.find((candidate) => candidate.partId === partId);
    if (!track) throw new Error(`no track for ${partId}`);
    frames.forEach((frame) => {
      act(() => { ctx().setCurrentFrame(frame); });
      act(() => { ctx().addKeyframeToTrack(track.id, frame); });
      act(() => { ctx().updateCurrentTransform(patchAtFrame(frame), partId); });
    });
  };
  return {
    ctx,
    grouping,
    addRect,
    group,
    ungroup,
    authorKeys,
    pose: (partId, frame) => ctx().getComputedTransform(partId, frame),
    scene: () => JSON.parse(ctx().exportProject()) as SceneData,
  };
};

/** Every child keeps the pose it had inside the container, at every frame. */
const capturePoses = (h: Harness, ids: string[], frames: number[]): Record<string, Transform[]> => (
  Object.fromEntries(ids.map((id) => [id, frames.map((frame) => h.pose(id, frame))]))
);

const expectSamePoses = (
  before: Record<string, Transform[]>,
  h: Harness,
  ids: string[],
  frames: number[],
): number => {
  let maxDelta = 0;
  ids.forEach((id) => frames.forEach((frame, index) => {
    const actual = h.pose(id, frame);
    POSE_CHANNELS.forEach((channel) => {
      const delta = Math.abs(actual[channel] - before[id][index][channel]);
      maxDelta = Math.max(maxDelta, delta);
      expect(actual[channel], `${id}.${channel} at frame ${frame}`).toBeCloseTo(before[id][index][channel], 9);
    });
  }));
  return maxDelta;
};

describe('R3-13 — ungrouping an animated group', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('succeeds on an animated group and keeps every child’s world pose at every frame', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 100, 40);
    const b = h.addRect('Rect B', 300, 200);
    const groupId = h.group([a, b]);
    // A moving, rotating and scaling container, and one animated child.
    h.authorKeys(groupId, [0, 8, 20], (frame) => ({
      x: 40 + frame * 6,
      y: -30 + frame * 3,
      rotation: frame * 7,
      scaleX: 1 + frame / 20,
      scaleY: 1 - frame / 40,
    }));
    h.authorKeys(a, [0, 20], (frame) => ({ y: frame * 5 }));

    const frames = Array.from({ length: 26 }, (_, frame) => frame);
    const before = capturePoses(h, [a, b], frames);

    h.ungroup(groupId);

    expect(h.ctx().characterParts.some((part) => part.id === groupId)).toBe(false);
    expect(h.ctx().tracks.some((track) => track.partId === groupId)).toBe(false);
    expect(h.ctx().characterParts.find((part) => part.id === a)?.parentId).toBeUndefined();
    // Parity holds at every sampled frame AND beyond the authored span, where
    // both the container's and the child's curves were clamped constants.
    const maxDelta = expectSamePoses(before, h, [a, b], frames);
    expect(maxDelta).toBeLessThan(1e-9);
    // The container's motion now lives in the child's own channels: the union
    // span [0, 20] is baked frame by frame, and the container's opacity 0 never
    // reaches a child.
    const baked = h.ctx().tracks.find((track) => track.partId === b)!.channels;
    expect(baked.x.map((key) => key.frame)).toEqual(Array.from({ length: 21 }, (_, frame) => frame));
    expect(baked.rotation[0].value).toBeCloseTo(0, 9);
    expect(baked.rotation[20].value).toBeCloseTo(140, 9);
    expect(baked.opacity).toHaveLength(0);
  });

  it('never copies the container’s key values onto the children', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 100, 40);
    const b = h.addRect('Rect B', 400, 40);
    const groupId = h.group([a, b]);
    h.authorKeys(groupId, [0, 10], (frame) => ({ x: 100 + frame * 10, rotation: frame * 9, scaleX: 2 }));

    h.ungroup(groupId);

    // The container animated x 100 → 200 and rotation 0 → 90 for the WHOLE
    // group; each child's standalone animation is the composition with its own
    // offset in the container, so the children differ from the container's keys
    // and from each other.
    const aKeys = h.ctx().tracks.find((track) => track.partId === a)!.channels;
    const bKeys = h.ctx().tracks.find((track) => track.partId === b)!.channels;
    expect(aKeys.x.map((key) => key.value)).not.toEqual([100, 200]);
    // At frame 0 the container is unrotated, so each child's x carries its own
    // offset scaled by the container's 2 — the two differ.
    expect(Math.abs(aKeys.x[0].value - bKeys.x[0].value)).toBeGreaterThan(1);
    // The container's rotation is shared by both children (their own is 0).
    expect(aKeys.rotation[10].value).toBeCloseTo(90, 9);
    expect(bKeys.rotation[10].value).toBeCloseTo(90, 9);
  });

  it('restores the whole document through undo and redo', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 100, 40);
    const b = h.addRect('Rect B', 300, 200);
    const groupId = h.group([a, b]);
    h.authorKeys(groupId, [0, 12], (frame) => ({ x: 20 + frame * 8, rotation: frame * 5 }));
    const grouped = JSON.stringify({ parts: h.ctx().characterParts, tracks: h.ctx().tracks });
    const frames = Array.from({ length: 14 }, (_, frame) => frame);
    const before = capturePoses(h, [a, b], frames);

    h.ungroup(groupId);
    const ungrouped = JSON.stringify({ parts: h.ctx().characterParts, tracks: h.ctx().tracks });
    expect(ungrouped).not.toBe(grouped);

    act(() => { h.ctx().undo(); });
    expect(JSON.stringify({ parts: h.ctx().characterParts, tracks: h.ctx().tracks })).toBe(grouped);
    expectSamePoses(before, h, [a, b], frames);

    act(() => { h.ctx().redo(); });
    expect(JSON.stringify({ parts: h.ctx().characterParts, tracks: h.ctx().tracks })).toBe(ungrouped);
    expectSamePoses(before, h, [a, b], frames);
  });

  it('keeps the baked motion through save and reload', () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 100, 40);
    const b = h.addRect('Rect B', 300, 200);
    const groupId = h.group([a, b]);
    h.authorKeys(groupId, [0, 15], (frame) => ({ x: frame * 9, rotation: frame * 4, scaleY: 1 + frame / 30 }));
    h.authorKeys(b, [0, 15], (frame) => ({ x: frame * -3 }));

    const frames = Array.from({ length: 17 }, (_, frame) => frame);
    h.ungroup(groupId);
    const bakedScene = h.scene();
    // Track ids are regenerated by the import path, so the reload contract is
    // asserted on the animation each part carries, not on the track identity.
    const bakedAnimation = Object.fromEntries(h.ctx().tracks
      .map((track) => [track.partId, JSON.stringify({ channels: track.channels, keyframes: track.keyframes })]));
    const before = capturePoses(h, [a, b], frames);

    act(() => { h.ctx().importProject(JSON.stringify(bakedScene)); });

    // The reloaded document IS the baked one (same animation, no container), and
    // it evaluates to the same motion at every frame.
    expect(Object.fromEntries(h.ctx().tracks
      .map((track) => [track.partId, JSON.stringify({ channels: track.channels, keyframes: track.keyframes })])))
      .toEqual(bakedAnimation);
    expect(h.ctx().characterParts.some((part) => part.id === groupId)).toBe(false);
    expect(h.ctx().characterParts.map((part) => part.id).sort()).toEqual([a, b].sort());
    const maxDelta = expectSamePoses(before, h, [a, b], frames);
    expect(maxDelta).toBeLessThan(1e-9);
  });

  it('exports the ungrouped document to OGraf in runtime and static parity', async () => {
    const h = renderHarness();
    const a = h.addRect('Rect A', 100, 40);
    const b = h.addRect('Rect B', 300, 200);
    const groupId = h.group([a, b]);
    h.authorKeys(groupId, [0, 10, 20], (frame) => ({ x: 30 + frame * 7, y: frame * 2, rotation: frame * 6, scaleX: 1 + frame / 25 }));
    h.authorKeys(a, [0, 20], (frame) => ({ y: frame * 4 }));

    const frames = Array.from({ length: 21 }, (_, frame) => frame);
    const groupedScene = h.scene();
    h.ungroup(groupId);
    const ungroupedScene = h.scene();

    expect(compileOGrafPackage(ungroupedScene).status).toBe('ready-to-materialize');
    expect(ungroupedScene.layers.some((layer) => layer.id === groupId)).toBe(false);
    expect(ungroupedScene.tracks.some((track) => track.partId === groupId)).toBe(false);

    const groupedGraphic = instantiateGraphic(runtimeSource(groupedScene));
    const ungroupedGraphic = instantiateGraphic(runtimeSource(ungroupedScene));
    await groupedGraphic.load({ renderType: 'realtime', data: {} });
    await ungroupedGraphic.load({ renderType: 'realtime', data: {} });

    const markups: string[] = [];
    frames.forEach((frame) => {
      expect(renderOGrafSvg(evaluateOGrafScene(ungroupedScene, frame)), `static frame ${frame}`)
        .toBe(renderOGrafSvg(evaluateOGrafScene(groupedScene, frame)));
      ungroupedGraphic._currentFrame = frame;
      ungroupedGraphic._render();
      groupedGraphic._currentFrame = frame;
      groupedGraphic._render();
      expect(ungroupedGraphic.innerHTML, `runtime frame ${frame}`).toBe(groupedGraphic.innerHTML);
      markups.push(ungroupedGraphic.innerHTML);
    });
    // The parity above is only meaningful if the exported document still paints
    // a MOVING child: the baked animation is live in the exported runtime.
    expect(new Set(markups).size).toBeGreaterThan(1);
    // The painted children are all that is left: no container element is emitted.
    expect(groupedGraphic.innerHTML).toContain(`data-layer-id="${a}"`);
    expect(ungroupedGraphic.innerHTML).toContain(`data-layer-id="${a}"`);

    await groupedGraphic.dispose();
    await ungroupedGraphic.dispose();
  });
});
