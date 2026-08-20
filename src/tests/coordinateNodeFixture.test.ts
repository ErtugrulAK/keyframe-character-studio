import { describe, expect, it } from 'vitest';
import { evaluateFrame } from '../utils/evaluateFrame';
import type { CharacterPart, Track } from '../types/animator';
import type { RuntimeData } from '../types/composition';

const runtime: RuntimeData = { appMode: 'edit', broadcast: {}, liveStunts: {} };

function layer(): CharacterPart {
  return {
    id: 'node-part', name: 'Node Fixture', type: 'custom_box', zIndex: 1,
    fillColor: '#fff', strokeColor: '#000', pivot: { x: 0, y: 0 },
    baseTransform: { x: 300, y: -100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  } as CharacterPart;
}

function track(): Track {
  return {
    id: 'node-track', partId: 'node-part', name: 'Node Fixture', color: '#fff',
    keyframes: [], visible: true, locked: false,
    channels: {
      x: [
        { id: 'x0', frame: 0, value: 0, easing: 'linear' },
        { id: 'x60', frame: 60, value: 300, easing: 'linear' },
      ],
      y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
    },
  } as Track;
}

describe('Coordinate V2 Node-facing canonical fixture', () => {
  it('evaluates raw project-unit values without Inspector conversion', () => {
    const layers = [layer()];
    const tracks = [track()];
    expect(evaluateFrame(layers, tracks, 60, 0, runtime, []).layers[0].transform.x).toBe(0);
    expect(evaluateFrame(layers, tracks, 60, 30, runtime, []).layers[0].transform.x).toBe(150);
    expect(evaluateFrame(layers, tracks, 60, 60, runtime, []).layers[0].transform.x).toBe(300);
    expect(evaluateFrame(layers, tracks, 60, 60, runtime, []).layers[0].transform.y).toBe(-100);
  });
});
