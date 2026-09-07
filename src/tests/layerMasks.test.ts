import { describe, expect, it } from 'vitest';
import type { CharacterPart, LayerMask } from '../types/animator';
import { buildLayerMaskDefinition, buildLayerMaskPathD } from '../utils/layerMasks';
import { evaluateLayerMasks } from '../utils/evaluateLayerMasks';
import { layerMaskChannel } from '../types/animator';

const part = {
  id: 'layer-1',
  type: 'custom_freeform',
  name: 'Freeform',
  width: 200,
  height: 100,
  points: [],
} as CharacterPart;

const path = {
  version: 1 as const,
  coordinateSpace: 'normalized' as const,
  closed: true,
  points: [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 1, y: 0 },
    { id: 'c', x: 1, y: 1 },
  ],
};

const world = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

describe('layer mask core', () => {
  it('maps normalized mask paths through part bounds and world transform', () => {
    const d = buildLayerMaskPathD(path, part, world, { x: 0, y: 0 });
    expect(d).toContain('M -90 -30');
    expect(d).toContain('L 110 -30');
    expect(d).toContain('L 110 70');
    expect(d).toContain('Z');
  });

  it('normalizes SVG definition values and skips disabled masks', () => {
    const mask: LayerMask = {
      id: 'mask-1',
      name: 'Mask',
      path,
      mode: 'subtract',
      inverted: true,
      opacity: 4,
      feather: -2,
      expansion: 3,
    };
    const definition = buildLayerMaskDefinition(part, mask, world, { x: 0, y: 0 });
    expect(definition).toMatchObject({
      id: 'kcs-layer-mask-layer-1-mask-1',
      mode: 'subtract',
      inverted: true,
      opacity: 1,
      feather: 0,
      expansion: 3,
    });
    expect(buildLayerMaskDefinition(part, { ...mask, enabled: false }, world, { x: 0, y: 0 })).toBeUndefined();
  });

  it('evaluates animated mask scalar properties on the layer track', () => {
    const mask: LayerMask = { id: 'mask-1', name: 'Mask', path, mode: 'add', opacity: 0.2, feather: 2, expansion: 0 };
    const track = {
      partId: part.id,
      channels: {} as never,
      maskChannels: {
        [layerMaskChannel('mask-1', 'opacity')]: [
          { id: 'a', frame: 0, value: 0.2, easing: 'linear' as const },
          { id: 'b', frame: 10, value: 0.8, easing: 'linear' as const },
        ],
        [layerMaskChannel('mask-1', 'feather')]: [
          { id: 'c', frame: 0, value: 2, easing: 'linear' as const },
          { id: 'd', frame: 10, value: 12, easing: 'linear' as const },
        ],
      },
    };
    const evaluated = evaluateLayerMasks({ ...part, masks: [mask] }, track, 5);
    expect(evaluated?.[0]).toMatchObject({ opacity: 0.5, feather: 7, expansion: 0 });
  });
});
