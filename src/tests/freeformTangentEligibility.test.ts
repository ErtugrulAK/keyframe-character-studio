import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { isFreeformTangentOverlayEligible } from '../utils/freeformTangentEligibility';
import type { FreeformTangentEligibilityInput } from '../utils/freeformTangentEligibility';

const identityTransform = { scaleX: 1, scaleY: 1 };

function makePart(overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id: 'free',
    name: 'Free',
    type: 'custom_freeform',
    zIndex: 1,
    points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
    ...overrides,
  } as CharacterPart;
}

function makeInput(overrides: Partial<FreeformTangentEligibilityInput> = {}): FreeformTangentEligibilityInput {
  const selectedPart = overrides.selectedPart === undefined ? makePart() : overrides.selectedPart;
  return {
    appMode: 'edit',
    activeTool: 'select',
    selectedPartIds: selectedPart ? [selectedPart.id] : [],
    selectedPart,
    selectedTransform: identityTransform,
    tracks: [],
    isDragging: false,
    ...overrides,
  };
}

describe('isFreeformTangentOverlayEligible', () => {
  it('accepts a single selected local freeform layer in edit mode with the select tool', () => {
    expect(isFreeformTangentOverlayEligible(makeInput())).toBe(true);
  });

  it('does not require an existing canonical path: legacy points are enough', () => {
    const input = makeInput({ selectedPart: makePart({ points: [{ x: 0, y: 0 }, { x: 10, y: 5 }] }) });
    expect(isFreeformTangentOverlayEligible(input)).toBe(true);
  });

  const guardRows: [string, Partial<FreeformTangentEligibilityInput>][] = [
    ['broadcast mode', { appMode: 'broadcast' }],
    ['a non-select tool', { activeTool: 'shape' }],
    ['an active stage drag', { isDragging: true }],
    ['an empty selection', { selectedPartIds: [], selectedPart: undefined }],
    ['a multi-selection', { selectedPartIds: ['free', 'other'] }],
    ['a missing selected part', { selectedPart: undefined, selectedPartIds: ['free'] }],
    ['a non-freeform layer', { selectedPart: makePart({ type: 'custom_rect' }) }],
    ['a boolean owner', { selectedPart: makePart({ booleanOperation: 'union' }) }],
    ['a boolean operand', { selectedPart: makePart({ booleanOperandIds: ['a', 'b'] }) }],
    ['a boolean operand child', { selectedPart: makePart({ booleanGroupId: 'group-1' }) }],
    ['a hidden track', { tracks: [{ partId: 'free', editVisible: false } as Track] }],
    ['a trimmed path', { selectedPart: makePart({ trimPathEnabled: true }) }],
    ['a missing evaluated transform', { selectedTransform: null }],
    ['a zero scaleX', { selectedTransform: { scaleX: 0, scaleY: 1 } }],
    ['a zero scaleY', { selectedTransform: { scaleX: 1, scaleY: 0 } }],
    ['a normalized-space path', {
      selectedPart: makePart({ path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 1 }] } }),
    }],
    ['a single-vertex path', {
      selectedPart: makePart({ path: { version: 1, coordinateSpace: 'local', closed: true, points: [{ id: 'a', x: 0, y: 0 }] } }),
    }],
    ['fewer than two legacy points', { selectedPart: makePart({ points: [{ x: 0, y: 0 }] }) }],
  ];

  it.each(guardRows)('rejects %s', (_label, overrides) => {
    expect(isFreeformTangentOverlayEligible(makeInput(overrides))).toBe(false);
  });

  it('prefers the canonical path over legacy points, even when the legacy points are unusable', () => {
    const input = makeInput({
      selectedPart: makePart({
        points: [{ x: 0, y: 0 }],
        path: {
          version: 1,
          coordinateSpace: 'local',
          closed: true,
          points: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 30, y: 30 }],
        },
      }),
    });
    expect(isFreeformTangentOverlayEligible(input)).toBe(true);
  });

  it('allows a hidden-flag track row other than the selected part', () => {
    const input = makeInput({ tracks: [{ partId: 'other', editVisible: false } as Track] });
    expect(isFreeformTangentOverlayEligible(input)).toBe(true);
  });

  it('allows negative and non-uniform scale', () => {
    expect(isFreeformTangentOverlayEligible(makeInput({ selectedTransform: { scaleX: -1.4, scaleY: 0.4 } }))).toBe(true);
  });
});
