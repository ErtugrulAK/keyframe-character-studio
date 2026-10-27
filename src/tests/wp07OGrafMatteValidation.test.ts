/**
 * WP-07 — the OGraf export validator must read matte relationships with the
 * SAME authority the editor, the stage and the generated runtime use
 * (`resolveMatteSource`): an enabled Track Matte wins, otherwise an enabled
 * legacy matte, otherwise none. A disabled relationship is inactive, so it can
 * neither form a blocking cycle nor report a blocking missing source, and a
 * disabled Track Matte lets the enabled legacy edge be the one validated.
 */
import { describe, expect, test } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { validateSceneForOGraf } from '../ograf';

const layer = (id: string, overrides: Partial<SceneLayer> = {}): SceneLayer => ({
  id,
  name: id.toUpperCase(),
  type: 'custom_box',
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 0, fillColor: '#ffffff', strokeColor: '#000000', width: 100, height: 50,
  ...overrides,
});

const scene = (layers: SceneLayer[]): SceneData => ({
  version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Matte', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks: [],
});

const matteErrors = (data: SceneData) => validateSceneForOGraf(data).diagnostics
  .filter((diagnostic) => diagnostic.severity === 'ERROR' && diagnostic.feature === 'track-matte')
  .map((diagnostic) => diagnostic.message);

describe('WP-07 OGraf matte validation follows the active relationship', () => {
  test('an ENABLED cycle still blocks', () => {
    const data = scene([
      layer('a', { trackMatte: { sourceLayerId: 'b', mode: 'alpha' } }),
      layer('b', { trackMatte: { sourceLayerId: 'a', mode: 'alpha' } }),
    ]);
    expect(matteErrors(data).some((message) => message.includes('cycle'))).toBe(true);
  });

  test('a cycle through a DISABLED relationship does not block', () => {
    const data = scene([
      layer('a', { trackMatte: { sourceLayerId: 'b', mode: 'alpha' } }),
      layer('b', { trackMatte: { sourceLayerId: 'a', mode: 'alpha', enabled: false } }),
    ]);
    expect(matteErrors(data)).toEqual([]);
  });

  test('a DISABLED relationship with a missing source does not block', () => {
    expect(matteErrors(scene([layer('a', { trackMatte: { sourceLayerId: 'gone', mode: 'alpha', enabled: false } })]))).toEqual([]);
    expect(matteErrors(scene([layer('a', { matte: { sourcePartId: 'gone', enabled: false } })]))).toEqual([]);
    // An enabled one still does.
    expect(matteErrors(scene([layer('a', { trackMatte: { sourceLayerId: 'gone', mode: 'alpha' } })])).some((message) => message.includes('not found'))).toBe(true);
  });

  test('a disabled Track Matte lets the enabled legacy edge be validated', () => {
    // V2 (disabled) points at a missing layer; legacy (enabled) at a real one.
    const data = scene([
      layer('a', { trackMatte: { sourceLayerId: 'gone', mode: 'alpha', enabled: false }, matte: { sourcePartId: 'b', mode: 'clip' } }),
      layer('b'),
    ]);
    expect(matteErrors(data)).toEqual([]);
  });
});
