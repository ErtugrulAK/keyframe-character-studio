import { describe, expect, it } from 'vitest';
import { addPropertyKeyframeMutator, deletePropertyKeyframeMutator, updatePropertyKeyframeFrameMutator } from '../utils/trackMutations';
import { layerMaskChannel } from '../types/animator';
import type { Track } from '../types/animator';

const track = (): Track => ({
  id: 'track-1',
  partId: 'layer-1',
  name: 'Layer',
  color: '#fff',
  visible: true,
  locked: false,
  channels: {
    x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
    maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
    trimPathStart: [], trimPathEnd: [], trimPathOffset: [],
  },
});

describe('layer mask timeline channels', () => {
  it('stores mask scalar keyframes on the canonical track and moves/removes them', () => {
    const channel = layerMaskChannel('mask-1', 'opacity');
    const added = addPropertyKeyframeMutator([track()], 'track-1', channel, 4, 0.5, 'linear', 'Sequence')[0];
    expect(added.maskChannels?.[channel]).toHaveLength(1);
    expect(added.channels.opacity).toHaveLength(0);

    const keyframeId = added.maskChannels![channel][0].id;
    const moved = updatePropertyKeyframeFrameMutator([added], 'track-1', channel, keyframeId, 8)[0];
    expect(moved.maskChannels![channel][0].frame).toBe(8);

    const removed = deletePropertyKeyframeMutator([moved], 'track-1', channel, keyframeId)[0];
    expect(removed.maskChannels![channel]).toHaveLength(0);
  });
});
