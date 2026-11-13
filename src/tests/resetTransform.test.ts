import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { createCustomPart } from '../utils/layers/partFactory';
import { resetTransforms } from '../utils/layers/resetTransform';
import { makeEmptyChannels } from '../utils/animation/defaults';

const key = (frame: number, value: number, templateId = 'Sequence') => ({ id: `k${frame}${templateId}`, frame, value, templateId });

describe('Reset Transform', () => {
  it('a new layer remembers the pose it was made with', () => {
    const { newPart } = createCustomPart('custom_rect', 'Box', 1, { baseTransform: { x: 120, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    expect(newPart.homeTransform).toEqual({ x: 120, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
  });

  it('returns a moved, turned, scaled layer to where it was made and clears its transform keys in this sequence only', () => {
    const { newPart, newTrack } = createCustomPart('custom_rect', 'Box', 1, { baseTransform: { x: 120, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } });
    const edited: CharacterPart = { ...newPart, baseTransform: { ...newPart.baseTransform, x: 500, y: 300, rotation: 45, scaleX: 2, scaleY: 0.5, opacity: 0.3 } };
    const track: Track = { ...newTrack, channels: { ...makeEmptyChannels(), x: [key(0, 0), key(10, 100), key(0, 7, 'Other')], fillColor: [] } as Track['channels'] };
    const result = resetTransforms([edited], [track], [edited.id], 'Sequence');
    expect(result).not.toBeNull();
    expect(result!.parts[0].baseTransform).toMatchObject({ x: 120, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
    expect(result!.tracks[0].channels.x).toEqual([key(0, 7, 'Other')]);
  });

  it('an older layer without a recorded pose keeps its position and loses turn, scale and opacity', () => {
    const old = { id: 'o', name: 'Old', type: 'custom_rect', zIndex: 1, baseTransform: { x: 10, y: 20, rotation: 30, scaleX: 3, scaleY: 3, opacity: 0.5 } } as CharacterPart;
    const result = resetTransforms([old], [], ['o'], 'Sequence');
    expect(result!.parts[0].baseTransform).toEqual({ x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
  });

  it('leaves unselected layers alone and reports no change when already at home', () => {
    const { newPart } = createCustomPart('custom_rect', 'Box', 1);
    expect(resetTransforms([newPart], [], [newPart.id], 'Sequence')).toBeNull();
    expect(resetTransforms([newPart], [], ['other'], 'Sequence')).toBeNull();
  });
});
