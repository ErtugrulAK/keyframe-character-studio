import { describe, expect, it } from 'vitest';
import type { CharacterPart, PropertyKeyframe, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { EDITOR_CAMERA_CENTER } from '../utils/geometry/projectCoordinates';
import { evaluateTransform } from '../utils/animation/evaluateTransform';
import {
  MIN_STAGE_CROP_SIZE,
  clampStageCropRect,
  editorPointToStageSpace,
  isFullStageCropRect,
  isStageCropHandle,
  isStagePointInsideRect,
  normalizeStageCropRect,
  resizeStageCropRect,
  resolveStageCropShiftRoots,
  shiftStageCropLayers,
  shiftStageCropTracks,
  stageCropHandleCenters,
  stageCropRectFromDrag,
  stageCropRectFromWorldBounds,
  stageCropResolution,
  stageCropShift,
  stageSpaceToEditorRect,
  translateStageCropRect,
} from '../utils/geometry/stageCrop';

/**
 * The stage crop authority, as pure math: the shift, the clamps, the region the
 * pointer draws/resizes, the region evaluated bounds produce and the exact layer
 * and track mutations a crop performs.
 */

const RES = { width: 1920, height: 1080 };

const makePart = (id: string, x: number, y = 0, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  fillColor: '#ffffff',
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
  easing: 'linear' as const,
  templateId,
}));

/** Output-space (stage-space) position of a layer: the frame origin cancels the shift out. */
const outputPoint = (parts: CharacterPart[], tracks: Track[], id: string, frame: number, resolution: { width: number; height: number }) => {
  const world = evaluateTransform(parts, tracks, 'Sequence', id, frame);
  return { x: world.x + resolution.width / 2, y: world.y + resolution.height / 2 };
};

describe('stage crop shift', () => {
  it('moves the frame, not the world: one uniform shift puts the region top-left on the new origin', () => {
    const rect = { x: 100, y: 50, width: 400, height: 300 };
    expect(stageCropShift(rect, RES)).toEqual({ dx: 660, dy: 340 });
    expect(stageCropResolution(rect)).toEqual({ width: 400, height: 300 });

    // The region corner IS the new origin, and it was the region corner before.
    const shift = stageCropShift(rect, RES);
    const relBefore = rect.x - RES.width / 2;
    expect(relBefore + shift.dx).toBeCloseTo(-400 / 2, 10);
    const relBeforeY = rect.y - RES.height / 2;
    expect(relBeforeY + shift.dy).toBeCloseTo(-300 / 2, 10);
  });

  it('is the identity region for the whole stage and detects it', () => {
    expect(stageCropShift({ x: 0, y: 0, ...RES }, RES)).toEqual({ dx: 0, dy: 0 });
    expect(isFullStageCropRect({ x: 0, y: 0, ...RES }, RES)).toBe(true);
    expect(isFullStageCropRect({ x: 0, y: 0, width: 1919, height: 1080 }, RES)).toBe(false);
  });
});

describe('stage crop region clamping', () => {
  it('refuses a region below the minimum usable size', () => {
    expect(normalizeStageCropRect({ x: 0, y: 0, width: MIN_STAGE_CROP_SIZE - 1, height: 100 })).toBeNull();
    expect(normalizeStageCropRect({ x: 0, y: 0, width: Number.NaN, height: 100 })).toBeNull();
    expect(normalizeStageCropRect(null)).toBeNull();
  });

  it('normalises a negative-size rectangle instead of rejecting it', () => {
    expect(normalizeStageCropRect({ x: 500, y: 400, width: -400, height: -300 }))
      .toEqual({ x: 100, y: 100, width: 400, height: 300 });
  });

  it('clamps a region into the stage and keeps the part that is over it', () => {
    expect(clampStageCropRect({ x: -200, y: -100, width: 800, height: 600 }, RES))
      .toEqual({ x: 0, y: 0, width: 600, height: 500 });
    // A corner region keeps exactly the pixels it covers...
    expect(clampStageCropRect({ x: 1800, y: 1000, width: 400, height: 400 }, RES))
      .toEqual({ x: 1800, y: 1000, width: 120, height: 80 });
    // ...and a region entirely off the stage has nothing to crop.
    expect(clampStageCropRect({ x: 2000, y: 1200, width: 400, height: 400 }, RES)).toBeNull();
  });
});

describe('the region the pointer draws', () => {
  it('normalises any drag direction and rounds to whole stage units', () => {
    expect(stageCropRectFromDrag({ x: 500.4, y: 400.6 }, { x: 100.2, y: 100.3 }, RES))
      .toEqual({ x: 100, y: 100, width: 400, height: 301 });
  });

  it('gives no region for a click, and clips a drag that runs off the stage', () => {
    expect(stageCropRectFromDrag({ x: 300, y: 300 }, { x: 302, y: 301 }, RES)).toBeNull();
    expect(stageCropRectFromDrag({ x: 1800, y: 900 }, { x: 2400, y: 1600 }, RES))
      .toEqual({ x: 1800, y: 900, width: 120, height: 180 });
  });

  it('moves a region without changing its size and keeps it on the stage', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 };
    expect(translateStageCropRect(rect, { x: 50, y: -40 }, RES)).toEqual({ x: 150, y: 60, width: 400, height: 300 });
    expect(translateStageCropRect(rect, { x: 5000, y: 5000 }, RES)).toEqual({ x: 1520, y: 780, width: 400, height: 300 });
    expect(translateStageCropRect(rect, { x: -5000, y: -5000 }, RES)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('resizes one edge at a time, holds the opposite edge and never collapses', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 };
    expect(resizeStageCropRect(rect, 'w', { x: 250, y: 999 }, RES)).toEqual({ x: 250, y: 100, width: 250, height: 300 });
    expect(resizeStageCropRect(rect, 'e', { x: 900, y: 0 }, RES)).toEqual({ x: 100, y: 100, width: 800, height: 300 });
    expect(resizeStageCropRect(rect, 'n', { x: 0, y: 180 }, RES)).toEqual({ x: 100, y: 180, width: 400, height: 220 });
    expect(resizeStageCropRect(rect, 's', { x: 0, y: 500 }, RES)).toEqual({ x: 100, y: 100, width: 400, height: 400 });
    // A handle dragged past its opposite edge parks on the minimum size.
    expect(resizeStageCropRect(rect, 'w', { x: 5000, y: 0 }, RES))
      .toEqual({ x: 500 - MIN_STAGE_CROP_SIZE, y: 100, width: MIN_STAGE_CROP_SIZE, height: 300 });
    // A corner moves both of its edges.
    expect(resizeStageCropRect(rect, 'nw', { x: 150, y: 150 }, RES)).toEqual({ x: 150, y: 150, width: 350, height: 250 });
  });

  it('places the eight handles on the edges and corners they own', () => {
    expect(stageCropHandleCenters({ x: 100, y: 50, width: 400, height: 300 })).toEqual({
      nw: { x: 100, y: 50 },
      n: { x: 300, y: 50 },
      ne: { x: 500, y: 50 },
      e: { x: 500, y: 200 },
      se: { x: 500, y: 350 },
      s: { x: 300, y: 350 },
      sw: { x: 100, y: 350 },
      w: { x: 100, y: 200 },
    });
    expect(isStageCropHandle('nw')).toBe(true);
    expect(isStageCropHandle('north')).toBe(false);
    expect(isStagePointInsideRect({ x: 200, y: 200 }, { x: 100, y: 100, width: 400, height: 300 })).toBe(true);
    expect(isStagePointInsideRect({ x: 20, y: 200 }, { x: 100, y: 100, width: 400, height: 300 })).toBe(false);
  });
});

describe('the region evaluated bounds produce', () => {
  it('converts project-relative bounds to stage space and rounds outward', () => {
    expect(stageCropRectFromWorldBounds({ minX: -900.4, maxX: -100.6, minY: -200.2, maxY: 100.9 }, RES))
      .toEqual({ x: 59, y: 339, width: 801, height: 302 });
  });

  it('clamps content that runs off the stage and refuses unmeasurable bounds', () => {
    expect(stageCropRectFromWorldBounds({ minX: -1400, maxX: 400, minY: -540, maxY: 540 }, RES))
      .toEqual({ x: 0, y: 0, width: 1360, height: 1080 });
    expect(stageCropRectFromWorldBounds({ minX: Number.NaN, maxX: 0, minY: 0, maxY: 0 }, RES)).toBeNull();
  });

  it('round-trips between stage space and the editor camera', () => {
    const rect = { x: 100, y: 50, width: 400, height: 300 };
    const editor = stageSpaceToEditorRect(rect, RES);
    expect(editor).toEqual({
      x: EDITOR_CAMERA_CENTER.x - RES.width / 2 + 100,
      y: EDITOR_CAMERA_CENTER.y - RES.height / 2 + 50,
      width: 400,
      height: 300,
    });
    expect(editorPointToStageSpace({ x: editor.x, y: editor.y }, RES)).toEqual({ x: 100, y: 50 });
    expect(editorPointToStageSpace({ x: EDITOR_CAMERA_CENTER.x, y: EDITOR_CAMERA_CENTER.y }, RES))
      .toEqual({ x: RES.width / 2, y: RES.height / 2 });
  });
});

describe('the layers a crop moves', () => {
  it('takes the top-level layers, and a layer whose container is missing counts as one', () => {
    const parts = [
      makePart('root', 0),
      makePart('child', 10, 0, { parentId: 'root' }),
      makePart('operand', 10, 0, { booleanGroupId: 'bool' }),
      makePart('dangling', 10, 0, { parentId: 'gone' }),
      makePart('bool', 0),
    ];
    expect(resolveStageCropShiftRoots(parts).sort()).toEqual(['bool', 'dangling', 'root']);
  });

  it('shifts a top-level layer and leaves a child in its container-local place', () => {
    const parts = [
      makePart('root', 100, 50),
      makePart('child', 10, 5, { parentId: 'root' }),
    ];
    const shifted = shiftStageCropLayers(parts, ['root'], { dx: 660, dy: 340 });
    expect(shifted[0].baseTransform.x).toBeCloseTo(760, 10);
    expect(shifted[0].baseTransform.y).toBeCloseTo(390, 10);
    // The child is returned by REFERENCE: an untouched layer must not re-render.
    expect(shifted[1]).toBe(parts[1]);
  });

  it('leaves rotation, scale, opacity, masks, mattes and media untouched', () => {
    const part = makePart('a', 100, 50, {
      baseTransform: { x: 100, y: 50, rotation: 33, scaleX: 2, scaleY: 0.5, opacity: 0.4 },
      masks: [{ id: 'm1', mode: 'add', enabled: true, inverted: false, feather: 0, opacity: 1, closed: true, points: [] }],
      matte: { sourcePartId: 'b', mode: 'alpha', inverted: true, enabled: true },
      imageUrl: 'data:image/png;base64,AAAA',
      imageContentBounds: { minX: -20, minY: -10, maxX: 20, maxY: 10 },
    });
    const [shifted] = shiftStageCropLayers([part], ['a'], { dx: 10, dy: -20 });
    expect(shifted.baseTransform).toEqual({ x: 110, y: 30, rotation: 33, scaleX: 2, scaleY: 0.5, opacity: 0.4 });
    expect(shifted.masks).toEqual(part.masks);
    expect(shifted.matte).toEqual(part.matte);
    expect(shifted.imageUrl).toBe(part.imageUrl);
    expect(shifted.imageContentBounds).toEqual(part.imageContentBounds);
  });

  it('shifts every sequence scope and the legacy keyframe positions of the moved layers', () => {
    const tracks = [
      makeTrack('a', {
        channels: {
          ...makeEmptyChannels(),
          x: [...channel([[0, 100], [30, 300]]), ...channel([[0, 5]], 'Intro')],
          y: [...channel([[0, 50]]), ...channel([[0, 7]], 'Intro')],
          rotation: channel([[0, 45]]),
        },
        keyframes: [{
          id: 'k1',
          frame: 0,
          transform: { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
          easing: 'linear',
          templateId: 'Sequence',
        }],
      }),
      makeTrack('b'),
    ];
    const shifted = shiftStageCropTracks(tracks, ['a'], { dx: 10, dy: -20 });
    expect(shifted[0].channels.x.map((keyframe) => keyframe.value)).toEqual([110, 310, 15]);
    expect(shifted[0].channels.y.map((keyframe) => keyframe.value)).toEqual([30, -13]);
    expect(shifted[0].channels.rotation.map((keyframe) => keyframe.value)).toEqual([45]);
    expect(shifted[0].keyframes?.[0].transform).toEqual({ x: 110, y: 30, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
    // The keyframe TIMES never move, and an untouched track keeps its identity.
    expect(shifted[0].channels.x.map((keyframe) => keyframe.frame)).toEqual([0, 30, 0]);
    expect(shifted[1]).toBe(tracks[1]);
  });

  it('writes nothing at all for a zero shift', () => {
    const parts = [makePart('a', 10)];
    const tracks = [makeTrack('a')];
    expect(shiftStageCropLayers(parts, ['a'], { dx: 0, dy: 0 })).toBe(parts);
    expect(shiftStageCropTracks(tracks, ['a'], { dx: 0, dy: 0 })).toBe(tracks);
  });
});

describe('the crop keeps authored motion relative to the new origin', () => {
  it('holds the output-space position of an animated, scaled and rotated layer at every frame', () => {
    const rect = { x: 300, y: 200, width: 800, height: 600 };
    const parts = [
      makePart('a', 0, 0, {
        baseTransform: { x: 0, y: 0, rotation: 30, scaleX: 1.5, scaleY: 0.75, opacity: 0.8 },
        parentId: undefined,
      }),
      makePart('group', -400, 100),
      makePart('child', 40, -20, { parentId: 'group' }),
      makePart('operand', 5, 5, { booleanGroupId: 'bool' }),
      makePart('bool', 250, -150),
    ];
    const tracks = [
      makeTrack('a', {
        channels: { ...makeEmptyChannels(), x: channel([[0, -600], [24, 120], [48, 700]]), y: channel([[0, 300], [24, -60], [48, 200]]) },
      }),
      makeTrack('group', {
        channels: { ...makeEmptyChannels(), x: channel([[0, -400], [48, 200]]), y: channel([[0, 100], [48, 100]]) },
      }),
      makeTrack('child'),
      makeTrack('operand'),
      makeTrack('bool'),
    ];

    const roots = resolveStageCropShiftRoots(parts);
    const shift = stageCropShift(rect, RES);
    const nextResolution = stageCropResolution(rect);
    const cropped = shiftStageCropLayers(parts, roots, shift);
    const croppedTracks = shiftStageCropTracks(tracks, roots, shift);

    const frames = [0, 12, 24, 36, 48];
    for (const id of ['a', 'group', 'child', 'operand', 'bool']) {
      for (const frame of frames) {
        // The world placement is preserved EXACTLY relative to the new frame:
        // every layer keeps the pixel it had, measured from the cropped origin.
        const before = outputPoint(parts, tracks, id, frame, RES);
        const after = outputPoint(cropped, croppedTracks, id, frame, nextResolution);
        expect(after.x).toBeCloseTo(before.x - rect.x, 6);
        expect(after.y).toBeCloseTo(before.y - rect.y, 6);
      }
    }
    // Rotation and scale are untouched by the shift.
    const beforeWorld = evaluateTransform(parts, tracks, 'Sequence', 'a', 24);
    const afterWorld = evaluateTransform(cropped, croppedTracks, 'Sequence', 'a', 24);
    expect(afterWorld.rotation).toBe(beforeWorld.rotation);
    expect(afterWorld.scaleX).toBe(beforeWorld.scaleX);
    expect(afterWorld.scaleY).toBe(beforeWorld.scaleY);
    expect(afterWorld.opacity).toBe(beforeWorld.opacity);
    // The child stayed in its container's space: its own authored value is intact.
    expect(cropped.find((part) => part.id === 'child')?.baseTransform.x).toBe(40);
  });
});
