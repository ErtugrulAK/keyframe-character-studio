import { describe, expect, it } from 'vitest';
import { migrateSceneLayerV6 } from '../utils/v6Migration';
import type { SceneLayer } from '../types/composition';

const baseLayer = (overrides: Partial<SceneLayer> = {}): SceneLayer => ({
  id: 'free-1',
  name: 'Freeform',
  type: 'custom_freeform',
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  zIndex: 1,
  fillColor: '#fff',
  strokeColor: '#000',
  points: [{ x: -20, y: -10 }, { x: 20, y: -10 }, { x: 20, y: 10 }],
  ...overrides,
});

describe('migrateSceneLayerV6', () => {
  it('adds a canonical path to legacy freeform points without removing them', () => {
    const migrated = migrateSceneLayerV6(baseLayer());
    expect(migrated.path?.version).toBe(1);
    expect(migrated.path?.points.map((point) => [point.x, point.y])).toEqual([
      [-20, -10], [20, -10], [20, 10],
    ]);
    expect(migrated.points).toHaveLength(3);
  });

  it('normalizes imported V6 path handles and mask paths', () => {
    const migrated = migrateSceneLayerV6(baseLayer({
      path: {
        version: 1,
        coordinateSpace: 'local',
        closed: false,
        points: [
          { id: 'p', x: 0, y: 0, handleIn: { x: Number.NaN, y: 2 } },
          { id: 'q', x: 1, y: 0 },
        ],
      },
      masks: [{
        path: {
          version: 1,
          coordinateSpace: 'normalized',
          closed: true,
          points: [{ id: 'm', x: 0, y: 0 }, { id: 'n', x: 1, y: 0 }],
        },
      }],
    }));
    expect(migrated.path?.points[0].handleIn).toBeUndefined();
    expect(migrated.masks?.[0].path.points[0].id).toBe('m');
  });
});
