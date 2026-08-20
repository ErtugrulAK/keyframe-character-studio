import { describe, it, expect } from 'vitest';
import { 
  addPropertyKeyframeMutator, 
  deleteSelectedKeyframeGroupMutator,
  deletePropertyKeyframeMutator, 
  updatePropertyKeyframeFrameMutator,
  updateKeyframeBezierPointsMutator 
} from '../utils/trackMutations';
import { Track } from '../types/animator';

describe('TrackMutations Utility', () => {
  const mockTrack: Track = {
    id: 'track_1',
    partId: 'part_1',
    name: 'Test',
    keyframes: [{
      id: 'kf_1',
      frame: 10,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      easing: 'bezier',
      bezierControlPoints: [0.1, 0.2, 0.8, 0.9]
    }],
    channels: {
      x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: []
    }
  };

  const tracks = [mockTrack];

  it('updates bezier points immutably', () => {
    const next = updateKeyframeBezierPointsMutator(tracks, 'track_1', 'kf_1', [0, 0, 1, 1]);
    expect(next).not.toBe(tracks);
    expect(next[0].keyframes[0].bezierControlPoints).toEqual([0, 0, 1, 1]);
    expect(tracks[0].keyframes[0].bezierControlPoints).toEqual([0.1, 0.2, 0.8, 0.9]); // Original untouched
  });

  it('adds a property keyframe', () => {
    const next = addPropertyKeyframeMutator(tracks, 'track_1', 'opacity', 20, 0.5, 'linear');
    expect(next[0].channels?.opacity).toBeDefined();
    expect(next[0].channels?.opacity?.[0].frame).toBe(20);
    expect(next[0].channels?.opacity?.[0].value).toBe(0.5);
  });

  it('deletes a property keyframe', () => {
    const next = addPropertyKeyframeMutator(tracks, 'track_1', 'opacity', 20, 0.5, 'linear');
    const addedKfId = next[0].channels?.opacity?.[0].id!;
    const final = deletePropertyKeyframeMutator(next, 'track_1', 'opacity', addedKfId);
    
    expect(final[0].channels?.opacity?.length).toBe(0);
  });

  it('updates a property keyframe frame and sorts correctly', () => {
    let next = addPropertyKeyframeMutator(tracks, 'track_1', 'opacity', 20, 0.5, 'linear');
    next = addPropertyKeyframeMutator(next, 'track_1', 'opacity', 30, 1, 'linear');
    
    const kf30 = next[0].channels?.opacity?.[1];
    expect(kf30?.frame).toBe(30);

    const final = updatePropertyKeyframeFrameMutator(next, 'track_1', 'opacity', kf30!.id, 15);
    
    // Because it changed from 30 to 15, and the other is 20, it should now be the first item.
    expect(final[0].channels?.opacity?.[0].id).toBe(kf30!.id);
    expect(final[0].channels?.opacity?.[0].frame).toBe(15);
  });

  it('deletes only the selected canonical frame group in the active template', () => {
    const track: Track = {
      ...mockTrack,
      keyframes: [],
      channels: {
        x: [
          { id: 'sequence-x', frame: 10, value: 10, easing: 'linear', templateId: 'Sequence' },
          { id: 'other-x', frame: 10, value: 20, easing: 'linear', templateId: 'Other' },
        ],
        y: [{ id: 'sequence-y', frame: 10, value: 30, easing: 'linear', templateId: 'Sequence' }],
        rotation: [], scaleX: [], scaleY: [], opacity: [],
      },
    };

    const result = deleteSelectedKeyframeGroupMutator([track], 'sequence-x', 'Sequence');

    expect(result.deleted).toBe(true);
    expect(result.tracks[0].channels?.x.map((keyframe) => keyframe.id)).toEqual(['other-x']);
    expect(result.tracks[0].channels?.y).toEqual([]);
  });

  it('preserves legacy composite-keyframe deletion compatibility', () => {
    const result = deleteSelectedKeyframeGroupMutator([mockTrack], 'kf_1', 'Sequence');

    expect(result.deleted).toBe(true);
    expect(result.tracks[0].keyframes).toEqual([]);
    expect(result.tracks[0].channels).toEqual(mockTrack.channels);
  });
});
