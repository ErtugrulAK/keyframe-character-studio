/**
 * Corner resize through the real authoring authorities.
 *
 * The canvas gesture is one call to `resolveCornerResize` followed by one
 * `updateCurrentTransform` write, bracketed by the batch history interaction.
 * These tests drive exactly that sequence against the canonical inspector write
 * authority and the canonical evaluator, so the frame/template/history
 * contracts are proven on the code path the canvas actually uses.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterPart, PropertyKeyframe, Track, TrackChannel, Transform } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';
import { evaluateTransform } from '../utils/evaluateTransform';
import { getPartLocalBounds } from '../utils/bounds';
import { resolveCornerResize } from '../utils/cornerResize';
import { useInspector } from '../hooks/useInspector';
import { useHistory, type HistoryDocumentState } from '../hooks/useHistory';

const FRAME = 30;

const part = (overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'alpha',
  name: 'Alpha',
  type: 'custom_rect',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  ...overrides,
} as CharacterPart);

const pk = (id: string, frame: number, value: number, templateId = 'Sequence'): PropertyKeyframe =>
  ({ id, frame, value, easing: 'linear', templateId } as PropertyKeyframe);

const track = (channels: Partial<Record<TrackChannel, PropertyKeyframe[]>> = {}): Track => ({
  id: 'track_alpha',
  partId: 'alpha',
  name: 'Alpha',
  color: '#22d3ee',
  keyframes: [],
  channels: { ...makeEmptyChannels(), ...channels },
  visible: true,
  locked: false,
} as Track);

const DOCUMENT_STATE: HistoryDocumentState = {
  fps: 30,
  totalFrames: 60,
  projectResolution: { width: 1920, height: 1080 },
  coordinateSystem: 'project-unit-center-v1',
  sceneTitle: 'Test',
  activeTemplateId: 'Sequence',
};

/**
 * The canvas surface: layers + tracks in state, the evaluator as the transform
 * getter, the inspector write authority and the batch history interaction.
 */
function harness(initialParts: CharacterPart[], initialTracks: Track[]) {
  return renderHook(() => {
    const [tracks, setTracks] = React.useState(initialTracks);
    const [characterParts, setCharacterParts] = React.useState(initialParts);
    const tracksRef = React.useRef(tracks);
    const characterPartsRef = React.useRef(characterParts);
    // Intentional latest-value mirrors, like the context does.
    // oxlint-disable-next-line react/refs
    tracksRef.current = tracks;
    // oxlint-disable-next-line react/refs
    characterPartsRef.current = characterParts;

    const getComputedTransform = (partId: string, frame: number): Transform => {
      const world = evaluateTransform(characterPartsRef.current, tracksRef.current, 'Sequence', partId, frame);
      return world as Transform;
    };

    const inspector = useInspector({
      selectedPartId: 'alpha',
      selectedPartIds: ['alpha'],
      activeTemplateId: 'Sequence',
      currentFrame: FRAME,
      tracks,
      characterParts,
      setTracks,
      setCharacterParts,
      getComputedTransform,
      addKeyframeToTrack: vi.fn(),
    });

    const history = useHistory({
      tracks,
      setTracks,
      tracksRef,
      characterParts,
      setCharacterParts,
      characterPartsRef,
      documentState: DOCUMENT_STATE,
      restoreDocumentState: vi.fn(),
    });

    /** Performs the corner drag exactly as the canvas does. */
    const dragCorner = (corner: 'tl' | 'tr' | 'bl' | 'br', travelX: number, travelY: number) => {
      const transform = getComputedTransform('alpha', FRAME);
      const bounds = getPartLocalBounds(characterPartsRef.current.find((p) => p.id === 'alpha')!);
      const local = {
        x: corner === 'tl' || corner === 'bl' ? bounds.minX : bounds.maxX,
        y: corner === 'tl' || corner === 'tr' ? bounds.minY : bounds.maxY,
      };
      const radians = (transform.rotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const startPointer = {
        x: transform.x + local.x * transform.scaleX * cos - local.y * transform.scaleY * sin,
        y: transform.y + local.x * transform.scaleX * sin + local.y * transform.scaleY * cos,
      };
      const patch = resolveCornerResize({
        transform,
        bounds,
        corner,
        startPointer,
        pointer: { x: startPointer.x + travelX, y: startPointer.y + travelY },
        uniform: true,
      });
      inspector.updateCurrentTransform(patch);
      return patch;
    };

    return { tracks, characterParts, inspector, history, dragCorner, getComputedTransform };
  });
}

const channelKfs = (trackEntry: Track, channel: TrackChannel) =>
  (trackEntry.channels?.[channel] ?? []).map((kf) => ({ frame: kf.frame, value: kf.value, templateId: kf.templateId }));

describe('corner resize — animated frame writes', () => {
  const keyedTrack = () => track({
    x: [pk('x0', 0, 40), pk('x30', FRAME, 40)],
    y: [pk('y0', 0, 0), pk('y30', FRAME, 0)],
    rotation: [pk('r0', 0, 0), pk('r30', FRAME, 0)],
    scaleX: [pk('sx0', 0, 1), pk('sx30', FRAME, 1), pk('sxStunt', FRAME, 5, 'Stunt')],
    scaleY: [pk('sy0', 0, 1), pk('sy30', FRAME, 1)],
    opacity: [pk('o0', 0, 1), pk('o30', FRAME, 1)],
  });

  it('rewrites only the current frame of the active template', () => {
    const { result } = harness([part({ baseTransform: { x: 40, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })], [keyedTrack()]);

    act(() => {
      result.current.history.startBatchInteraction();
      result.current.dragCorner('br', -30, 15);
      result.current.history.endBatchInteraction();
    });

    const alphaTrack = result.current.tracks.find((entry) => entry.partId === 'alpha')!;
    // Frame 30 of the active template is rewritten on every axis the drag touched.
    expect(channelKfs(alphaTrack, 'x').find((kf) => kf.frame === FRAME)!.value).not.toBe(40);
    expect(channelKfs(alphaTrack, 'scaleX').find((kf) => kf.frame === FRAME)!.value).not.toBe(1);
    expect(channelKfs(alphaTrack, 'scaleY').find((kf) => kf.frame === FRAME)!.value).not.toBe(1);
    // Every other keyframe is untouched: same count, same values, same frames.
    expect(channelKfs(alphaTrack, 'x')).toHaveLength(2);
    expect(channelKfs(alphaTrack, 'x').find((kf) => kf.frame === 0)!.value).toBe(40);
    expect(channelKfs(alphaTrack, 'scaleX')).toHaveLength(3);
    expect(channelKfs(alphaTrack, 'scaleX').find((kf) => kf.frame === 0)!.value).toBe(1);
    expect(channelKfs(alphaTrack, 'scaleY').find((kf) => kf.frame === 0)!.value).toBe(1);
    // The other sequence at the same frame is never touched.
    expect(channelKfs(alphaTrack, 'scaleX').find((kf) => kf.templateId === 'Stunt')!.value).toBe(5);
    // A keyed layer keeps its static transform.
    expect(result.current.characterParts[0].baseTransform.scaleX).toBe(1);
  });

  it('holds the opposite corner in world space at the animated frame', () => {
    const { result } = harness([part({ baseTransform: { x: 40, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } })], [keyedTrack()]);
    const bounds = { minX: -60, minY: -30, maxX: 60, maxY: 30 };
    const fixedBefore = { x: 40 + bounds.minX, y: bounds.minY };

    act(() => {
      result.current.history.startBatchInteraction();
      result.current.dragCorner('br', -30, 15);
      result.current.history.endBatchInteraction();
    });

    const evaluated = result.current.getComputedTransform('alpha', FRAME);
    const fixedAfter = {
      x: evaluated.x + bounds.minX * evaluated.scaleX,
      y: evaluated.y + bounds.minY * evaluated.scaleY,
    };
    expect(fixedAfter.x).toBeCloseTo(fixedBefore.x, 9);
    expect(fixedAfter.y).toBeCloseTo(fixedBefore.y, 9);
    // Another frame is untouched by the frame-30 edit.
    const other = result.current.getComputedTransform('alpha', 0);
    expect(other.x).toBe(40);
    expect(other.scaleX).toBe(1);
  });

  it('writes the static transform when the layer carries no animation', () => {
    const { result } = harness([part()], [track()]);
    act(() => {
      result.current.dragCorner('tl', -24, -12);
    });
    const alphaTrack = result.current.tracks.find((entry) => entry.partId === 'alpha')!;
    expect(channelKfs(alphaTrack, 'scaleX')).toHaveLength(0);
    expect(result.current.characterParts[0].baseTransform.scaleX).toBeGreaterThan(1);
    expect(result.current.characterParts[0].baseTransform.x).toBeLessThan(0);
  });

  it('translates a parented world patch into the child container space', () => {
    const parentPart = part({ id: 'parent', name: 'Parent', baseTransform: { x: 90, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const childPart = part({ parentId: 'parent', baseTransform: { x: 30, y: -20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const { result } = harness(
      [parentPart, childPart],
      [{ ...track(), id: 'track_parent', partId: 'parent' }],
    );

    const before = result.current.getComputedTransform('alpha', FRAME);
    const worldFixed = { x: before.x + 60, y: before.y + 30 };

    act(() => {
      result.current.dragCorner('tl', -20, 15);
    });

    const after = result.current.getComputedTransform('alpha', FRAME);
    expect(after.x + 60 * after.scaleX).toBeCloseTo(worldFixed.x, 9);
    expect(after.y + 30 * after.scaleY).toBeCloseTo(worldFixed.y, 9);
    // The authored values are container-local; the world result is what holds.
    const childAuthored = result.current.characterParts.find((entry) => entry.id === 'alpha')!;
    expect(childAuthored.baseTransform.x).not.toBeCloseTo(after.x, 6);
  });
});

describe('corner resize — history contract', () => {
  it('records one gesture as one undo step and restores both directions exactly', () => {
    const { result } = harness([part()], [track()]);
    const before = JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts });

    act(() => {
      result.current.history.startBatchInteraction();
      // A live drag writes on every pointer move…
      result.current.dragCorner('br', -18, 9);
      result.current.dragCorner('br', -30, 15);
      // …and the pointer-up closes the single history entry.
      result.current.history.endBatchInteraction();
    });

    const after = JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts });
    expect(after).not.toBe(before);
    expect(result.current.history.canUndo).toBe(true);

    act(() => {
      result.current.history.undo();
    });
    expect(JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts })).toBe(before);
    // Exactly one step was recorded: the very next state is the seed.
    expect(result.current.history.canUndo).toBe(false);

    act(() => {
      result.current.history.redo();
    });
    expect(JSON.stringify({ tracks: result.current.tracks, parts: result.current.characterParts })).toBe(after);
  });
});
