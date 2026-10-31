import React, { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { AuthoringToolbar } from '../components/Toolbar/AuthoringToolbar';
import type { CharacterPart, PropertyKeyframe, Track } from '../types/animator';
import type { SceneData } from '../types/composition';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { getLayerWorldBounds } from '../utils/layers/layerGrouping';
import { resolveGifDimensions } from '../export/gifPlan';
import { compileOGrafManifest } from '../ograf/compiler';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { evaluateSceneFrame } from '../ograf/evaluation';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { generateGraphicModule } from '../ograf/runtimeTemplate';

/**
 * The stage crop, driven through the real provider and the real toolbar: what a
 * crop writes is what the evaluator, the serializer and the export stacks read,
 * the world keeps its place relative to the new frame, and one crop is exactly
 * one undo entry.
 */

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

interface Harness {
  ctx: () => AnimatorContextType;
  /** The whole document: layers, animation and the stage size. */
  document: () => string;
  seed: (parts: CharacterPart[], tracks: Track[]) => void;
  outputPoint: (id: string, frame: number) => { x: number; y: number };
}

const renderHarness = (): Harness => {
  let live: AnimatorContextType | null = null;
  render(
    <AnimatorProvider>
      <Consumer onCtx={(context) => { live = context; }} />
      <AuthoringToolbar />
    </AnimatorProvider>,
  );
  const ctx = (): AnimatorContextType => {
    if (!live) throw new Error('provider context not captured yet');
    return live;
  };
  return {
    ctx,
    document: () => JSON.stringify({
      parts: ctx().characterParts,
      tracks: ctx().tracks,
      resolution: ctx().projectResolution,
    }),
    seed: (parts, tracks) => {
      act(() => { ctx().setCharacterParts(parts); });
      act(() => { ctx().setTracks(tracks); });
    },
    outputPoint: (id, frame) => {
      const world = ctx().getComputedTransform(id, frame);
      const resolution = ctx().projectResolution;
      return { x: world.x + resolution.width / 2, y: world.y + resolution.height / 2 };
    },
  };
};

const makePart = (id: string, x: number, y = 0, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  pivot: { x: 0, y: 0 },
  baseTransform: { x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

const makeTrack = (partId: string, overrides: Partial<Track> = {}): Track => ({
  id: `track_${partId}`,
  partId,
  name: partId,
  color: '#38bdf8',
  visible: true,
  locked: false,
  keyframes: [],
  channels: makeEmptyChannels(),
  ...overrides,
});

const channel = (values: [number, number][], templateId = 'Sequence'): PropertyKeyframe[] => values.map(([frame, value], index) => ({
  id: `${templateId}_${frame}_${index}`,
  frame,
  value,
  easing: 'linear',
  templateId,
}));

const setRegion = (h: Harness, rect: { x: number; y: number; width: number; height: number }) => {
  act(() => { h.ctx().setCropRegion(rect); });
};

const applyCrop = (h: Harness) => {
  let result = false;
  act(() => { result = h.ctx().applyStageCrop(); });
  return result;
};

describe('stage crop commands', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('applies the drawn region as ONE undo entry that restores the stage and the positions', () => {
    const h = renderHarness();
    h.seed(
      [makePart('a', -600, -300), makePart('b', 200, 100), makePart('c', 700, 400)],
      [makeTrack('a'), makeTrack('b'), makeTrack('c')],
    );
    const before = h.document();
    const beforePoints = ['a', 'b', 'c'].map((id) => h.outputPoint(id, 0));

    setRegion(h, { x: 300, y: 200, width: 800, height: 600 });
    expect(applyCrop(h)).toBe(true);
    expect(h.ctx().projectResolution).toEqual({ width: 800, height: 600 });

    // Every layer keeps the pixel it had, measured from the cropped origin.
    ['a', 'b', 'c'].forEach((id, index) => {
      const after = h.outputPoint(id, 0);
      expect(after.x).toBeCloseTo(beforePoints[index].x - 300, 6);
      expect(after.y).toBeCloseTo(beforePoints[index].y - 200, 6);
    });

    const cropped = h.document();
    expect(cropped).not.toBe(before);

    // ONE entry: a single undo is the exact document the crop started from.
    act(() => { h.ctx().undo(); });
    expect(h.document()).toBe(before);
    expect(h.ctx().projectResolution).toEqual({ width: 1920, height: 1080 });

    act(() => { h.ctx().redo(); });
    expect(h.document()).toBe(cropped);
  });

  it('preserves animation, groups, rotation, masks and mattes relative to the new origin', () => {
    const h = renderHarness();
    const mask = { id: 'm1', mode: 'add' as const, enabled: true, inverted: false, feather: 4, opacity: 1, closed: true, points: [] };
    const parts = [
      makePart('a', 0, 0, { baseTransform: { x: 0, y: 0, rotation: 30, scaleX: 1.5, scaleY: 0.75, opacity: 0.8 } }),
      makePart('group', -400, 100),
      makePart('child', 40, -20, { parentId: 'group', masks: [mask] }),
      makePart('bool', 250, -150),
      makePart('operand', 5, 5, { booleanGroupId: 'bool', matte: { sourcePartId: 'a', mode: 'alpha', inverted: true, enabled: true } }),
      makePart('masked', 500, -400, { masks: [mask] }),
    ];
    const tracks = [
      makeTrack('a', {
        channels: { ...makeEmptyChannels(), x: channel([[0, -600], [24, 120], [48, 700]]), y: channel([[0, 300], [24, -60], [48, 200]]) },
      }),
      makeTrack('group', { channels: { ...makeEmptyChannels(), x: channel([[0, -400], [48, 200]]) } }),
      makeTrack('child'),
      makeTrack('bool'),
      makeTrack('operand'),
      makeTrack('masked'),
    ];
    h.seed(parts, tracks);
    const frames = [0, 12, 24, 36, 48];
    const before = frames.map((frame) => ['a', 'group', 'child', 'bool', 'operand', 'masked'].map((id) => h.outputPoint(id, frame)));

    // The region {300,200,800,600} on 1920×1080 shifts by (960−300−400, 540−200−300).
    const shift = { dx: 260, dy: 40 };
    setRegion(h, { x: 300, y: 200, width: 800, height: 600 });
    expect(applyCrop(h)).toBe(true);

    frames.forEach((frame, frameIndex) => {
      ['a', 'group', 'child', 'bool', 'operand', 'masked'].forEach((id, idIndex) => {
        const after = h.outputPoint(id, frame);
        expect(after.x).toBeCloseTo(before[frameIndex][idIndex].x - 300, 6);
        expect(after.y).toBeCloseTo(before[frameIndex][idIndex].y - 200, 6);
      });
    });

    const next = h.ctx();
    const a = next.characterParts.find((part) => part.id === 'a');
    expect(a.baseTransform.rotation).toBe(30);
    expect(a.baseTransform.scaleX).toBe(1.5);
    expect(a.baseTransform.opacity).toBe(0.8);
    // Masks, mattes, groups and parenting survive untouched.
    expect(next.characterParts.find((part) => part.id === 'child')?.masks).toEqual([mask]);
    expect(next.characterParts.find((part) => part.id === 'operand')?.matte).toEqual({ sourcePartId: 'a', mode: 'alpha', inverted: true, enabled: true });
    expect(next.characterParts.find((part) => part.id === 'child')?.parentId).toBe('group');
    expect(next.characterParts.find((part) => part.id === 'child')?.baseTransform.x).toBe(40);
    // The animation moved with the layers: same frames, shifted values.
    const aTrack = next.tracks.find((track) => track.partId === 'a')!;
    expect(aTrack.channels.x.map((keyframe) => keyframe.frame)).toEqual([0, 24, 48]);
    expect(aTrack.channels.x.map((keyframe) => keyframe.value))
      .toEqual([-600 + shift.dx, 120 + shift.dx, 700 + shift.dx]);
    expect(aTrack.channels.y.map((keyframe) => keyframe.value))
      .toEqual([300 + shift.dy, -60 + shift.dy, 200 + shift.dy]);
  });

  it('updates the export stacks: scene JSON, scene.kcs, OGraf manifest + runtime SVG and the GIF size', () => {
    const h = renderHarness();
    h.seed([makePart('a', -600, -300)], [makeTrack('a')]);

    setRegion(h, { x: 300, y: 200, width: 800, height: 600 });
    expect(applyCrop(h)).toBe(true);

    const scene = JSON.parse(h.ctx().exportProject()) as CompositionSceneData & { layers: Array<{ id: string; x: number }> };
    expect({ width: scene.width, height: scene.height }).toEqual({ width: 800, height: 600 });
    // SceneData carries the shifted authored position — the OGraf renderer and the
    // runtime both read it, never a second copy. {300,200,800,600} on 1920×1080
    // shifts x by 960 − 300 − 400 = 260.
    expect(scene.layers.find((layer) => layer.id === 'a')?.x).toBe(-600 + 260);

    // GIF: the frame size comes from the exported scene's own dimensions.
    expect(resolveGifDimensions(scene.width, scene.height, 0.5)).toEqual({ width: 400, height: 300 });

    // OGraf: manifest render requirements.
    const manifest = compileOGrafManifest(scene).manifest;
    expect(manifest.renderRequirements?.[0].resolution.width.ideal).toBe(800);
    expect(manifest.renderRequirements?.[0].resolution.height.ideal).toBe(600);

    // OGraf: the generated runtime and the rendered SVG both speak the new size.
    // The runtime embeds the scene verbatim (`JSON.stringify`), so the stage it
    // draws with is the cropped one.
    const runtimeModule = generateGraphicModule(scene);
    expect(runtimeModule).toContain('"width":800');
    expect(runtimeModule).toContain('"height":600');
    const svg = renderOGrafSvg(evaluateSceneFrame(scene, 0));
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">');

    // OGraf package: the editable scene inside the zip is the cropped document.
    const pkg = compileOGrafPackage(scene);
    const sceneFile = pkg.files.find((file) => file.path === 'scene.kcs')!;
    const packaged = JSON.parse(sceneFile.content!) as SceneData;
    expect({ width: packaged.width, height: packaged.height }).toEqual({ width: 800, height: 600 });
    expect(packaged.layers.find((layer) => layer.id === 'a')?.x).toBe(-600 + 260);
  });

  it('round-trips exactly through save and reload, and can crop again afterwards', () => {
    const h = renderHarness();
    // The tracks carry the canonical persisted state a saved document has, so the
    // round trip below is a statement about the DOCUMENT, not about the import
    // normalisation of a hand-built fixture.
    h.seed(
      [makePart('a', -600, -300), makePart('b', 700, 400)],
      [makeTrack('a', { editVisible: true }), makeTrack('b', { editVisible: true })],
    );
    setRegion(h, { x: 300, y: 200, width: 800, height: 600 });
    expect(applyCrop(h)).toBe(true);

    // The saved document IS the cropped document: export → import → export is
    // byte-identical, and the stage it carries is the new one. (The editor's
    // session metadata — a track's display name and colour — is regenerated by
    // the importer, so the contract is stated over the exported document, which
    // is exactly what a `.kcs` file holds.)
    const croppedExport = h.ctx().exportProject();
    const saved = JSON.parse(croppedExport) as SceneData & { layers: Array<{ id: string; x: number; y: number }> };
    expect({ width: saved.width, height: saved.height }).toEqual({ width: 800, height: 600 });
    expect(saved.layers.find((layer) => layer.id === 'a')).toMatchObject({ x: -340, y: -260 });

    act(() => { h.ctx().importProject(croppedExport); });
    expect(h.ctx().projectResolution).toEqual({ width: 800, height: 600 });
    expect(h.ctx().exportProject()).toBe(croppedExport);

    // A crop of the reloaded document still moves the world by one more shift.
    const beforeSecond = h.outputPoint('a', 0);
    setRegion(h, { x: 100, y: 100, width: 400, height: 300 });
    expect(applyCrop(h)).toBe(true);
    expect(h.ctx().projectResolution).toEqual({ width: 400, height: 300 });
    expect(h.outputPoint('a', 0).x).toBeCloseTo(beforeSecond.x - 100, 6);
  });

  it('crops to the current selection, measured at the CURRENT frame', () => {
    const h = renderHarness();
    h.seed(
      [makePart('a', 0, 0, { width: 100, height: 100 }), makePart('b', 900, 500)],
      [
        makeTrack('a', { channels: { ...makeEmptyChannels(), x: channel([[0, 0], [20, 400]]) } }),
        makeTrack('b'),
      ],
    );
    act(() => {
      h.ctx().setSelectedPartIds(['a']);
      h.ctx().setSelectedPartId('a');
    });
    expect(h.ctx().canCropStageToSelection).toBe(true);

    // The region is measured at frame 0, where the layer sits at x = 0.
    const boundsAtZero = getLayerWorldBounds(h.ctx().characterParts, 'a', (id) => h.ctx().getComputedTransform(id, 0))!;
    const expectedRegionZero = {
      width: Math.ceil(boundsAtZero.maxX + 960) - Math.floor(boundsAtZero.minX + 960),
      height: Math.ceil(boundsAtZero.maxY + 540) - Math.floor(boundsAtZero.minY + 540),
    };
    const regionLeft = Math.floor(boundsAtZero.minX + 960);
    const regionTop = Math.floor(boundsAtZero.minY + 540);
    const beforeFrameZero = h.outputPoint('a', 0);

    act(() => { h.ctx().cropStageToSelection(); });
    expect(h.ctx().projectResolution).toEqual(expectedRegionZero);
    // The layer keeps its place in the world, measured from the cropped origin,
    // so the region it produced encloses it without clipping it.
    expect(h.outputPoint('a', 0).x).toBeCloseTo(beforeFrameZero.x - regionLeft, 6);
    expect(h.outputPoint('a', 0).y).toBeCloseTo(beforeFrameZero.y - regionTop, 6);

    // From frame 20 the same command measures where the layer IS at that frame,
    // which is what makes the measurement a CURRENT-FRAME measurement.
    act(() => { h.ctx().undo(); });
    act(() => { h.ctx().setCurrentFrame(20); });
    const boundsAtTwenty = getLayerWorldBounds(h.ctx().characterParts, 'a', (id) => h.ctx().getComputedTransform(id, 20))!;
    const beforeFrameTwenty = h.outputPoint('a', 20);
    expect(boundsAtTwenty.minX).not.toBeCloseTo(boundsAtZero.minX, 3);

    act(() => { h.ctx().cropStageToSelection(); });
    expect(h.ctx().projectResolution).toEqual(expectedRegionZero);
    expect(h.outputPoint('a', 20).x).toBeCloseTo(beforeFrameTwenty.x - Math.floor(boundsAtTwenty.minX + 960), 6);
  });

  it('crops to visible content and ignores canvas-hidden layers and empty groups', () => {
    const h = renderHarness();
    h.seed(
      [
        makePart('a', -600, -300, { width: 100, height: 100 }),
        makePart('b', 400, 300, { width: 100, height: 100 }),
        makePart('hidden', 5000, 5000, { width: 4000, height: 4000 }),
        makePart('emptyGroup', 0, 0, { isGroup: true }),
      ],
      [
        makeTrack('a'),
        makeTrack('b'),
        makeTrack('hidden', { editVisible: false }),
        makeTrack('emptyGroup'),
      ],
    );
    expect(h.ctx().canCropStageToVisibleContent).toBe(true);

    const boxes = ['a', 'b'].map((id) => getLayerWorldBounds(h.ctx().characterParts, id, (partId) => h.ctx().getComputedTransform(partId, 0))!);
    const minX = Math.floor(Math.min(...boxes.map((bounds) => bounds.minX)) + 960);
    const maxX = Math.ceil(Math.max(...boxes.map((bounds) => bounds.maxX)) + 960);
    const minY = Math.floor(Math.min(...boxes.map((bounds) => bounds.minY)) + 540);
    const maxY = Math.ceil(Math.max(...boxes.map((bounds) => bounds.maxY)) + 540);

    act(() => { h.ctx().cropStageToVisibleContent(); });
    expect(h.ctx().projectResolution).toEqual({ width: maxX - minX, height: maxY - minY });
    // The hidden layer is not part of the measurement (4000×4000 at 5000,5000
    // would have produced a stage of many thousands), and the crop encloses the
    // visible art without clipping it.
    const a = h.outputPoint('a', 0);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThanOrEqual(h.ctx().projectResolution.width);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeLessThanOrEqual(h.ctx().projectResolution.height);
  });

  it('refuses a crop that cannot move a stage-anchored layer, and a no-op region', () => {
    const h = renderHarness();
    h.seed([makePart('pinned', 0, 0, { anchor: 'top-left' })], [makeTrack('pinned')]);
    const before = h.document();
    expect(h.ctx().stageCropBlockReason).toBeTruthy();
    expect(h.ctx().canCropStageToSelection).toBe(false);

    setRegion(h, { x: 300, y: 200, width: 800, height: 600 });
    expect(applyCrop(h)).toBe(false);
    expect(h.document()).toBe(before);
    expect(h.ctx().projectResolution).toEqual({ width: 1920, height: 1080 });
    // The refusal left the region alone so the user can fix the anchor and retry.
    expect(h.ctx().cropRegion).not.toBeNull();

    // A region that IS the whole stage writes nothing.
    act(() => { h.ctx().setCharacterParts([makePart('a', 10, 10)]); });
    act(() => { h.ctx().setTracks([makeTrack('a')] as unknown as AnimatorTrack[]); });
    const fullStage = h.document();
    setRegion(h, { x: 0, y: 0, width: 1920, height: 1080 });
    expect(applyCrop(h)).toBe(false);
    expect(h.document()).toBe(fullStage);
  });

  it('measures an image by its transparent-free content box, not by its bitmap', () => {
    const h = renderHarness();
    const content = { minX: -20, minY: -10, maxX: 20, maxY: 10 };
    h.seed([
      makePart('image', 0, 0, {
        type: 'custom_image',
        width: 400,
        height: 300,
        imageUrl: 'data:image/png;base64,AAAA',
        imageContentBounds: content,
      }),
    ], [makeTrack('image')]);
    act(() => {
      h.ctx().setSelectedPartIds(['image']);
      h.ctx().setSelectedPartId('image');
    });

    act(() => { h.ctx().cropStageToSelection(); });
    expect(h.ctx().projectResolution).toEqual({ width: 40, height: 20 });
    expect(h.outputPoint('image', 0)).toEqual({ x: 20, y: 10 });
  });

  it('clears the region without touching the document, and Escape leaves the mode', () => {
    const h = renderHarness();
    h.seed([makePart('a', 0, 0)], [makeTrack('a')]);
    const before = h.document();
    act(() => { h.ctx().setCropMode(true); });
    setRegion(h, { x: 100, y: 100, width: 400, height: 300 });
    expect(h.document()).toBe(before);

    act(() => { h.ctx().clearStageCropRegion(); });
    expect(h.ctx().cropRegion).toBeNull();
    expect(h.document()).toBe(before);

    act(() => { h.ctx().setCropRegion({ x: 100, y: 100, width: 400, height: 300 }); });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(h.ctx().cropRegion).toBeNull();
    expect(h.ctx().cropMode).toBe(true);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(h.ctx().cropMode).toBe(false);
    expect(h.document()).toBe(before);
  });
});
