/**
 * WP-07 — the pre-export capability report is a per-layer reading of the REAL
 * validator's diagnostics: ERROR → blocked, WARNING only → conditional,
 * nothing → supported; project-wide issues are kept separately; nothing is
 * dropped.
 */
import { describe, expect, it } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import { validateSceneForOGraf } from '../ograf';
import { buildOGrafCapabilityReport } from '../ograf/capabilityReport';

const layer = (id: string, overrides: Partial<SceneLayer> = {}): SceneLayer => ({
  id,
  name: id.toUpperCase(),
  type: 'custom_box',
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
  visible: true, zIndex: 0, fillColor: '#ffffff', strokeColor: '#000000', width: 100, height: 50,
  ...overrides,
});

describe('WP-07 OGraf capability report', () => {
  it('classifies layers from the real validator: supported, conditional (clip matte), blocked (feather matte)', () => {
    const layers = [
      layer('plain'),
      layer('clipped', { matte: { sourcePartId: 'plain', mode: 'clip' } }),
      layer('feathered', { matte: { sourcePartId: 'plain', mode: 'alpha', feather: 6 } }),
    ];
    const scene: SceneData = { version: 1, coordinateSystem: 'project-unit-center-v1', name: 'Check', width: 1920, height: 1080, fps: 30, totalFrames: 60, layers, tracks: [] };
    const diagnostics = validateSceneForOGraf(scene).diagnostics;
    const report = buildOGrafCapabilityReport(layers, diagnostics);

    expect(report.layers.map((entry) => [entry.id, entry.status])).toEqual([
      ['plain', 'supported'],
      ['clipped', 'conditional'],
      ['feathered', 'blocked'],
    ]);
    expect(report.counts).toEqual({ supported: 1, conditional: 1, blocked: 1 });
    expect(report.canExport).toBe(false);
    // Every diagnostic is accounted for — per layer or project-wide.
    const listed = report.layers.flatMap((entry) => entry.issues).length + report.sceneIssues.length;
    expect(listed).toBe(diagnostics.length);
  });

  it('keeps diagnostics without a known layer as project issues and follows the export rule', () => {
    const report = buildOGrafCapabilityReport([{ id: 'a', name: 'A' }], [
      { code: 'OGRAF_INVALID_PROJECT', severity: 'ERROR', message: 'Bad project.' },
      { code: 'OGRAF_ASSET_UNVERIFIED', severity: 'WARNING', message: 'Ghost layer.', layerId: 'ghost' },
    ]);
    expect(report.layers).toEqual([{ id: 'a', name: 'A', status: 'supported', issues: [] }]);
    expect(report.sceneIssues.map((issue) => issue.message)).toEqual(['Bad project.', 'Ghost layer.']);
    expect(report.canExport).toBe(false);
    expect(buildOGrafCapabilityReport([{ id: 'a' }], []).layers[0]).toMatchObject({ name: 'a', status: 'supported' });
  });
});
