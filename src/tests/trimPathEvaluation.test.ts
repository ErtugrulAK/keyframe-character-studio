import { describe, expect, it } from 'vitest';
import { evaluateFrame } from '../utils/evaluateFrame';
import { makeEmptyChannels } from '../utils/defaults';
import type { CharacterPart, Track } from '../types/animator';

const layer: CharacterPart = {
  id: 'shape', name: 'Shape', type: 'custom_rect', zIndex: 1, fillColor: '#fff', strokeColor: '#000', pivot: { x: 0.5, y: 0.5 },
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 0, trimPathOffset: 0,
};

const track = (channels: Partial<ReturnType<typeof makeEmptyChannels>> = {}): Track => ({
  id: 'track', partId: 'shape', name: 'Shape', color: '#fff', visible: true, locked: false,
  channels: { ...makeEmptyChannels(), ...channels }, keyframes: [],
});

const runtime = { appMode: 'edit' as const, broadcast: {}, liveStunts: {} };

describe('Trim Path canonical channel evaluation', () => {
  it('evaluates Start/End/Offset through Track.channels and template filtering', () => {
    const channels = makeEmptyChannels();
    channels.trimPathStart = [{ id: 's0', frame: 0, value: 0, easing: 'linear', templateId: 'SPECIAL' }, { id: 's1', frame: 60, value: 0.75, easing: 'linear', templateId: 'SPECIAL' }];
    channels.trimPathEnd = [{ id: 'e0', frame: 0, value: 0.25, easing: 'linear', templateId: 'SPECIAL' }, { id: 'e1', frame: 60, value: 1, easing: 'linear', templateId: 'SPECIAL' }];
    channels.trimPathOffset = [{ id: 'o0', frame: 0, value: 0, easing: 'linear', templateId: 'SPECIAL' }, { id: 'o1', frame: 60, value: 180, easing: 'linear', templateId: 'SPECIAL' }];
    const frame = evaluateFrame([layer], [track(channels)], 60, 30, runtime, [], undefined, 'SPECIAL');
    expect(frame.layers[0].content.trimPathEnabled).toBe(true);
    expect(frame.layers[0].content.trimPathStart).toBeCloseTo(0.375);
    expect(frame.layers[0].content.trimPathEnd).toBeCloseTo(0.625);
    expect(frame.layers[0].content.trimPathOffset).toBeCloseTo(90);
  });

  it('keeps legacy layers on the legacy renderer contract when modern fields are absent', () => {
    const legacy = { ...layer, trimPathEnabled: undefined, trimPathStart: undefined, trimPathEnd: undefined, trimPathOffset: undefined, strokeProgress: 0.5 };
    const frame = evaluateFrame([legacy], [track()], 60, 30, runtime, []);
    expect(frame.layers[0].content.trimPathEnabled).toBeUndefined();
    expect(frame.layers[0].content.trimPathEnd).toBeUndefined();
  });
});
